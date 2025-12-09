"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createPortfolio(name: string, currency: string) {
    try {
        const portfolio = await prisma.portfolio.create({
            data: {
                name,
                currency,
            },
        });
        revalidatePath("/");
        return { success: true, data: portfolio };
    } catch (error) {
        return { success: false, error: "Failed to create portfolio" };
    }
}

export async function getPortfolios() {
    try {
        const portfolios = await prisma.portfolio.findMany({
            include: {
                transactions: true,
            },
            orderBy: {
                createdAt: 'asc'
            }
        });
        return { success: true, data: portfolios };
    } catch (error) {
        return { success: false, error: "Failed to fetch portfolios" };
    }
}

export async function getPortfolioSummary(portfolioId: string) {
    try {
        const transactions = await prisma.transaction.findMany({
            where: { portfolioId },
            include: { asset: true }
        });

        let totalInvested = 0;
        const holdings = new Map<string, number>();
        const prices = new Map<string, number>();

        for (const tx of transactions) {
            // Update prices map
            if (tx.asset && tx.asset.currentPrice) {
                prices.set(tx.asset.symbol, tx.asset.currentPrice);
            }

            if (tx.type === "BUY") {
                totalInvested += tx.amount + (tx.fee || 0);
                if (tx.assetSymbol && tx.quantity) {
                    holdings.set(tx.assetSymbol, (holdings.get(tx.assetSymbol) || 0) + tx.quantity);
                }
            } else if (tx.type === "SELL") {
                totalInvested -= tx.amount; // Net flow approach
                if (tx.assetSymbol && tx.quantity) {
                    holdings.set(tx.assetSymbol, (holdings.get(tx.assetSymbol) || 0) - tx.quantity);
                }
            } else if (tx.type === "DIVIDEND") {
                // Dividends are profit, they reduce "cost" or are just cash in.
                // If we consider "Total Invested" as "Net Cost", then dividends reduce it.
                // Let's treat them as return.
                totalInvested -= tx.amount;
            }
            // Handling SaveBack and RoundUp? Treat as Buy?
            else if (tx.type === "SAVEBACK" || tx.type === "ROUNDUP") {
                // These are usually small buys
                totalInvested += tx.amount; // It's money put in (usually from cash back, but still "invested")
                if (tx.assetSymbol && tx.quantity) {
                    holdings.set(tx.assetSymbol, (holdings.get(tx.assetSymbol) || 0) + tx.quantity);
                }
            }
        }

        let currentValue = 0;
        holdings.forEach((qty, symbol) => {
            const price = prices.get(symbol) || 0;
            currentValue += qty * price;
        });

        // Loop transactions again if we want to fallback to "last price paid" for assets without current price?
        // For now, if price is 0, value is 0.

        const unrealizedPL = currentValue - totalInvested;
        const roi = totalInvested !== 0 ? (unrealizedPL / totalInvested) * 100 : 0;

        return {
            success: true,
            data: {
                totalInvested,
                currentValue,
                unrealizedPL,
                roi
            }
        };
    } catch (error) {
        console.error("Error calculating summary:", error);
        return { success: false, error: "Failed to calculate summary" };
    }
}

export async function getPortfolioHistory(portfolioId: string) {
    try {
        const transactions = await prisma.transaction.findMany({
            where: { portfolioId },
            orderBy: { date: 'asc' },
            include: { asset: true }
        });

        if (transactions.length === 0) return { success: true, data: [] };

        const holdings = new Map<string, number>();
        const prices = new Map<string, number>();
        let invested = 0;
        const points = new Map<string, { invested: number, value: number }>();

        function calculateValue() {
            let val = 0;
            holdings.forEach((qty, symbol) => {
                val += qty * (prices.get(symbol) || 0);
            });
            return val;
        }

        // Add initial point before first transaction? No, start at 0?
        // Let's start from first transaction date.

        for (const tx of transactions) {
            // Update last known price if available in transaction
            if (tx.assetSymbol && tx.pricePerUnit) {
                prices.set(tx.assetSymbol, tx.pricePerUnit);
            }

            // Logic matching summary calculation, but progressive
            if (tx.type === "BUY") {
                invested += tx.amount + (tx.fee || 0);
                if (tx.assetSymbol && tx.quantity) {
                    holdings.set(tx.assetSymbol, (holdings.get(tx.assetSymbol) || 0) + tx.quantity);
                }
            } else if (tx.type === "SELL") {
                invested -= tx.amount;
                if (tx.assetSymbol && tx.quantity) {
                    holdings.set(tx.assetSymbol, (holdings.get(tx.assetSymbol) || 0) - tx.quantity);
                }
            } else if (tx.type === "DIVIDEND") {
                invested -= tx.amount;
            } else if (tx.type === "SAVEBACK" || tx.type === "ROUNDUP") {
                invested += tx.amount;
                if (tx.assetSymbol && tx.quantity) {
                    holdings.set(tx.assetSymbol, (holdings.get(tx.assetSymbol) || 0) + tx.quantity);
                }
            }

            // Record point
            const dateStr = tx.date.toISOString().split('T')[0];
            // If multiple tx on same day, this overwrites, which is fine (end of day state)
            points.set(dateStr, { invested, value: calculateValue() });
        }

        // Add "Today" point with current prices if possible? 
        // We can check if today is already there. IF not, add it.
        const todayStr = new Date().toISOString().split('T')[0];
        if (!points.has(todayStr)) {
            // Update prices to current stored prices for better accuracy at "now"?
            // But we don't want to fetch all assets again inside this loop or complexity.
            // Let's stick to "last transaction price" for history consistency, 
            // OR if we want the chart to end at "Current Value" shown in summary, we should use current prices.
            // The summary uses `tx.asset.currentPrice`. 
            // Let's try to update prices with currentPrice from the transactions includes (which returns current DB state).
            transactions.forEach((tx: any) => {
                if (tx.asset && tx.asset.currentPrice) {
                    prices.set(tx.asset.symbol, tx.asset.currentPrice);
                }
            });
            points.set(todayStr, { invested, value: calculateValue() });
        }

        const data = Array.from(points.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, val]) => ({ date, ...val }));

        return { success: true, data };

    } catch (error) {
        console.error("Error generating history:", error);
        return { success: false, error: "Failed to generate history" };
    }
}
