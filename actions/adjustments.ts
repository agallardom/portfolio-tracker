"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

function parseSymbol(assetName: string): string | null {
    // pattern 1: "SYMBOL - Name"
    const dashMatch = assetName.match(/^([A-Z0-9\.]+)\s-/);
    if (dashMatch) return dashMatch[1].trim();

    // pattern 2: "Name (SYMBOL)"
    const parenMatch = assetName.match(/\(([A-Z0-9\.]+)\)$/);
    if (parenMatch) return parenMatch[1].trim();

    // pattern 3: Just "SYMBOL" (fallback)
    if (!assetName.includes(' ') && assetName.length < 10) {
        return assetName;
    }

    return null;
}

function parseDate(dateStr: string): Date | null {
    try {
        // format: "dd/mm/yyyy hh:mm"
        const [datePart, timePart] = dateStr.split(' ');
        const [day, month, year] = datePart.split('/');

        let hour = 0;
        let minute = 0;
        if (timePart) {
            [hour, minute] = timePart.split(':').map(Number);
        }

        return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), hour || 0, minute || 0));
    } catch (e) {
        return null;
    }
}

export async function applyAdjustments(portfolioId: string, jsonContent: string) {
    try {
        const data = JSON.parse(jsonContent);

        if (!data.portfolio_summary || !Array.isArray(data.portfolio_summary)) {
            return { success: false, error: "Invalid JSON format: missing 'portfolio_summary' array." };
        }

        const results = {
            updated: [] as string[],
            unchanged: [] as string[],
            notFound: [] as string[],
            transactionsUpdated: 0
        };

        for (const item of data.portfolio_summary) {
            const rawName = item.asset_name;
            const parsedSymbol = parseSymbol(rawName);

            // Try 1: Exact symbol match
            let targetAsset = parsedSymbol ? await prisma.asset.findUnique({ where: { symbol: parsedSymbol } }) : null;

            // Try 2: Partial symbol match (e.g. NESN.ZU -> NESN) if 1 failed
            if (!targetAsset && parsedSymbol && parsedSymbol.includes('.')) {
                const baseSymbol = parsedSymbol.split('.')[0];
                // Risky? Maybe findFirst where symbol starts with baseSymbol?
                // Let's rely on name search first as it's safer.
            }

            // Try 2 (Better): Match by Name (substring) or prefix
            if (!targetAsset) {
                // Heuristic: remove ticker from "TIC - Name" string to get name
                const namePart = rawName.includes('-') ? rawName.split('-')[1].trim() : rawName;

                // Try finding asset where name contains this namePart (if long enough)
                if (namePart.length > 3) {
                    // This is fuzzy. Let's try exact matches or known variations.
                    // The scripts/check-assets output showed "NESN.SW (Nestlé S.A.)"
                    // The input has "NESN.ZU - Nestle SA"
                    // "Nestle SA" ~ "Nestlé S.A."

                    // Let's look for symbol prefix match in DB?
                    if (parsedSymbol) {
                        const base = parsedSymbol.split('.')[0];
                        if (base.length >= 3) {
                            const candidates = await prisma.asset.findMany({
                                where: {
                                    symbol: { startsWith: base }
                                }
                            });
                            // If only 1 candidate, assume match?
                            if (candidates.length === 1) {
                                targetAsset = candidates[0];
                            }
                        }
                    }
                }
            }

            // Manual Override for known hard cases if needed? 
            // Better to report "Not Found" and let user fix name or add aliases later.

            if (!targetAsset) {
                results.notFound.push(item.asset_name);
                continue;
            }

            // Process Positions (Transaction Reconciliation)
            if (item.positions && Array.isArray(item.positions) && targetAsset) {
                for (const pos of item.positions) {
                    try {
                        const units = parseFloat(pos.units);
                        if (isNaN(units) || units <= 0) continue;

                        // Identify type
                        let subType = 'BUY';
                        // eToro uses localized strings like "Comprar", "Vender"? 
                        // The sample has "Comprar", "Comprar 24/5", "Comprar DIV"
                        if (pos.type && pos.type.toLowerCase().includes('vend')) {
                            subType = 'SELL';
                        }

                        const posDate = parseDate(pos.datetime); // We need a helper for "dd/mm/yyyy hh:mm"
                        if (!posDate) continue;

                        // Find matching transaction
                        // Criteria: Portfolio, Asset, Type, Quantity (approx), Date (Same Day)

                        // We need to fetch candidates first
                        // optimization: maybe fetch all txs for this asset once? But loop is easier for now.

                        const candidates = await prisma.transaction.findMany({
                            where: {
                                portfolioId,
                                assetSymbol: targetAsset.symbol,
                                type: subType,
                                // quantity needs range check, hard in prisma direct query for floats
                                // so we fetch date range match and filter in JS
                                date: {
                                    gte: new Date(posDate.getTime() - 24 * 60 * 60 * 1000), // -1 day
                                    lte: new Date(posDate.getTime() + 24 * 60 * 60 * 1000)  // +1 day
                                }
                            }
                        });

                        // Filter closest match
                        const match = candidates.find(tx => {
                            const qtyDiff = Math.abs((tx.quantity || 0) - units);
                            return qtyDiff < 0.001;
                        });

                        if (match) {
                            const openingPrice = pos.opening_price;
                            let exchangeRate = match.exchangeRate || 1.0;

                            // User Logic: exchangeRate = pricePerUnit / opening_price
                            if (match.pricePerUnit && openingPrice > 0) {
                                exchangeRate = match.pricePerUnit / openingPrice;
                            }

                            // Update Transaction
                            await prisma.transaction.update({
                                where: { id: match.id },
                                data: {
                                    pricePerUnitInAssetCurrency: openingPrice,
                                    exchangeRate: exchangeRate,
                                    assetCurrency: targetAsset.quoteCurrency || 'EUR' // Fallback? Or use what's in Asset
                                }
                            });
                            results.transactionsUpdated++;
                        }

                    } catch (err) {
                        console.error("Error processing position:", err);
                    }
                }
            }

            // Asset Update Logic (Existing)
            const price = item.current_price;
            const netValue = item.net_value;
            const units = item.total_investment_units;

            let numericUnits = 0;
            if (typeof units === 'number') {
                numericUnits = units;
            } else if (typeof units === 'string') {
                if (!units.includes('<')) {
                    numericUnits = parseFloat(units);
                }
            }

            let exchangeRateToUSD = 1.0;
            let rateCalculated = false;

            if (numericUnits > 0 && price > 0) {
                const impliedRate = netValue / (numericUnits * price);
                if (impliedRate > 0 && isFinite(impliedRate)) {
                    exchangeRateToUSD = impliedRate;
                    rateCalculated = true;
                }
            }

            // Check if update is needed
            const priceDiff = Math.abs((targetAsset.currentPrice || 0) - price);
            const isPriceDifference = priceDiff > 0.000001;
            // Also check rate difference?

            if (!isPriceDifference && !rateCalculated) {
                // Nothing new to update (assuming rate didn't change if we didn't calc it)
                results.unchanged.push(targetAsset.symbol);
                continue;
            }

            // Update
            const updateData: any = {
                currentPrice: price,
                updatedAt: new Date(),
            };

            if (rateCalculated) {
                updateData.exchangeRateToUSD = exchangeRateToUSD;
            }

            await prisma.asset.update({
                where: { symbol: targetAsset.symbol },
                data: updateData
            });
            results.updated.push(targetAsset.symbol);
        }

        revalidatePath(`/portfolio/${portfolioId}`);
        return {
            success: true,
            message: `Processed. Assets [Updated: ${results.updated.length}, Unchanged: ${results.unchanged.length}, Not Found: ${results.notFound.length}]. Transactions Updated: ${results.transactionsUpdated}`,
            results
        };

    } catch (error) {
        console.error("Failed to apply adjustments:", error);
        return { success: false, error: "Failed to process adjustments file." };
    }
}
