'use server';

import { prisma } from "@/lib/db"; // Assuming prisma is exported as 'db' or 'prisma' from lib/db. Using 'prisma' based on previous file.
import { db } from "@/lib/db";
import YahooFinance from "yahoo-finance2";
import { auth } from "@/auth";

const yahooFinance = new YahooFinance();

export async function generateOptimizationPrompt() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Unauthorized" };
        }
        const userId = session.user.id;

        // 1. Fetch User Context (Risk Profile)
        const userProfile = await db.riskProfile.findUnique({
            where: { userId: userId }
        });

        const profile = userProfile?.profile || "[Completar: Moderado / Agresivo]";
        const horizon = userProfile?.investmentHorizon || "[Completar: Medio / Largo Plazo]";
        const goal = userProfile?.investmentGoal || "[Completar: Crecimiento / Dividendos]";
        const restrictions = userProfile?.restrictions || "Ninguna";

        // 2. Fetch User's Portfolios and Transactions
        const portfolios = await db.portfolio.findMany({
            where: { userId: userId },
            include: {
                transactions: true
            }
        });

        // 3. Aggregate Holdings and Calculate Cash
        let cashBalance = 0;
        const holdingsMap = new Map<string, { qty: number, cost: number, symbol: string }>();

        // We need a way to get Asset Names. We could fetch distinctive assets.
        // Let's collect all symbols first to fetch names/prices in bulk or one-by-one safely.
        const referencedSymbols = new Set<string>();

        for (const port of portfolios) {
            for (const tx of port.transactions) {
                if (tx.assetSymbol) referencedSymbols.add(tx.assetSymbol);

                // Cash Logic (Simple approximation based on Transaction Types)
                // DEPOSIT: +Cash
                // WITHDRAWAL: -Cash
                // BUY: -Cash
                // SELL: +Cash
                // DIVIDEND: +Cash
                // INTEREST: +Cash
                // FEE: -Cash

                // Note: Logic must match portfolio.ts for consistency
                if (tx.type === 'DEPOSIT') {
                    cashBalance += tx.amount;
                } else if (tx.type === 'WITHDRAWAL') {
                    cashBalance -= tx.amount;
                } else if (tx.type === 'BUY' || tx.type === 'SAVEBACK' || tx.type === 'ROUNDUP') {
                    // Money leaves cash to buy asset
                    // Adjust for original currency or assume EUR base? 
                    // Simplified: Everything is normalized to EUR in `amount`?
                    // Schema checks: amount is Float.
                    // Assuming amount is cost for BUY.

                    // Specific logic: 
                    // SAVEBACK/ROUNDUP might be auto-invested (gift-like logic or from card?). 
                    // Usually treated as "Spent from account".
                    cashBalance -= (tx.amount || 0);
                    cashBalance -= (tx.fee || 0);

                    // Asset Qty
                    if (tx.assetSymbol && tx.quantity) {
                        const current = holdingsMap.get(tx.assetSymbol) || { qty: 0, cost: 0, symbol: tx.assetSymbol };
                        holdingsMap.set(tx.assetSymbol, {
                            qty: current.qty + tx.quantity,
                            cost: current.cost + (tx.amount || 0) + (tx.fee || 0),
                            symbol: tx.assetSymbol
                        });
                    }

                } else if (tx.type === 'SELL') {
                    // Money enters cash
                    cashBalance += (tx.amount || 0);
                    // Fee usually separate or netted? Schema has 'fee'.
                    cashBalance -= (tx.fee || 0);

                    // Asset Qty
                    if (tx.assetSymbol && tx.quantity) {
                        const current = holdingsMap.get(tx.assetSymbol) || { qty: 0, cost: 0, symbol: tx.assetSymbol };
                        holdingsMap.set(tx.assetSymbol, {
                            qty: current.qty - tx.quantity,
                            cost: current.cost, // Cost basis handling is complex, ignoring for simple "Avg Buy Price" unless we want FIFO. 
                            // For "Avg Buy Price" prompt, we usually stick to "Total Cost / Total Bought" or just ignore sells. 
                            // Keeping it simple: Don't reduce cost, only reduce Qty. Avg Price = Cost / BoughtQty might be safer.
                            // Actually, user wants "Avg Buy Price". 
                            symbol: tx.assetSymbol
                        });
                    }

                } else if (tx.type === 'DIVIDEND' || tx.type === 'INTEREST') {
                    cashBalance += (tx.amount || 0);
                } else if (tx.type === 'GIFT') {
                    // Incoming money/stock?
                    // If stock (has quantity), it adds to holdings but maybe 0 cost?
                    if (tx.quantity && tx.assetSymbol) {
                        const current = holdingsMap.get(tx.assetSymbol) || { qty: 0, cost: 0, symbol: tx.assetSymbol };
                        holdingsMap.set(tx.assetSymbol, {
                            qty: current.qty + tx.quantity,
                            cost: current.cost, // 0 cost
                            symbol: tx.assetSymbol
                        });
                    } else {
                        // Cash gift
                        cashBalance += (tx.amount || 0);
                    }
                }
            }
        }

        // 4. Enrich Holdings with Prices and Names
        const portfolioItems = [];
        let totalAssetValue = 0;

        // Fetch Asset Details (Names)
        const assetsDB = await db.asset.findMany({
            where: { symbol: { in: Array.from(referencedSymbols) } }
        });
        const assetMap = new Map(assetsDB.map(a => [a.symbol, a]));

        for (const [symbol, data] of holdingsMap.entries()) {
            if (data.qty < 0.00001) continue; // Skip empty positions

            const asset = assetMap.get(symbol);
            const name = asset?.name || symbol;

            // Get Price
            let price = asset?.currentPrice || 0;
            if (price === 0) {
                try {
                    const quote = await yahooFinance.quote(symbol);
                    price = quote.regularMarketPrice || 0;
                } catch (e) {
                    console.warn(`Failed to fetch price for ${symbol}`);
                }
            }

            const value = data.qty * price;
            totalAssetValue += value;

            // Calculate Avg Buy Price
            // Data.cost is "Net Cost" (Buy - Sell?). No, above I avoided reducing cost on Sell.
            // But we prefer "Avg Cost of Held Shares". 
            // Better: Recalulate strictly from BUYs.

            // Re-scan transactions for this symbol to get accurate Avg Buy Price
            let buyQty = 0;
            let buyCost = 0;
            for (const port of portfolios) {
                for (const tx of port.transactions) {
                    if (tx.assetSymbol === symbol && (tx.type === 'BUY' || tx.type === 'SAVEBACK' || tx.type === 'ROUNDUP') && tx.quantity) {
                        buyQty += tx.quantity;
                        buyCost += (tx.amount || 0) + (tx.fee || 0);
                    }
                }
            }
            const avgPrice = buyQty > 0 ? (buyCost / buyQty) : 0;


            portfolioItems.push({
                symbol: symbol,
                name: name,
                quantity: data.qty,
                avgPrice: avgPrice,
                currentPrice: price,
                value: value
            });
        }

        const totalCapital = cashBalance + totalAssetValue;

        // Sort by value
        portfolioItems.sort((a, b) => b.value - a.value);

        // Format Asset List
        const assetLines = portfolioItems.map(item => {
            const weight = (totalCapital > 0) ? (item.value / totalCapital) * 100 : 0;
            return `*   **${item.symbol} (${item.name}):** ${item.quantity.toFixed(4)} @ ${item.avgPrice.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € (Peso: ${weight.toFixed(2)}%)`;
        }).join('\n');


        // Construct the Prompt format
        const prompt = `🚀 **Prompt Maestro para Optimización con Deep Search**

**Instrucciones de Búsqueda:** Utiliza tus capacidades de búsqueda profunda para obtener datos de mercado en tiempo real (cotizaciones, tipos de interés actuales, previsiones macroeconómicas de 2025 y ratios de Sharpe de activos específicos).

### 👤 I. CONTEXTO DEL INVERSOR
*   **Perfil:** ${profile}
*   **Horizonte:** ${horizon}
*   **Objetivo:** ${goal}
*   **Capital Total:** ~${totalCapital.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} (Incluyendo ${cashBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} en liquidez)
*   **Restricciones:** ${restrictions}

### 📊 II. CARTERA ACTUAL (Datos Extraídos)
${assetLines}

### 🔍 III. MANDATO DE INVESTIGACIÓN (Deep Search Task)
Realiza una investigación exhaustiva sobre los siguientes puntos antes de proponer cambios:

1.  **Análisis de Ratios Actualizados:** Busca los Ratios de Sharpe, Beta y Volatilidad (Standard Deviation) de los últimos 12 meses para cada activo de mi lista.
2.  **Contexto Macro 2025:** Investiga la tendencia actual de los tipos de interés de los bancos centrales (BCE/Fed) y las previsiones de inflación para ajustar la proporción de Renta Fija.
3.  **Detección de Solapamientos:** Analiza si mis activos individuales se solapan excesivamente con mis ETFs.
4.  **Búsqueda de Alternativas:** Busca 3 activos con mejor desempeño ajustado al riesgo que no estén en mi cartera.

### 📈 IV. ESTRUCTURA DEL INFORME DE SALIDA
Genera un informe ejecutivo con:
*   **Semáforo de Salud:** (Verde/Amarillo/Rojo) sobre la alineación riesgo-cartera.
*   **Análisis de Riesgo:** Volatilidad y Max Drawdown esperado.
*   **Propuesta de Rebalanceo:** Qué vender (baja eficiencia) y qué comprar.
*   **Justificación:** Basada en datos macro actuales.`;

        return { success: true, prompt };

    } catch (e: any) {
        console.error("Error generating prompt:", e);
        return { success: false, error: e.message };
    }
}
