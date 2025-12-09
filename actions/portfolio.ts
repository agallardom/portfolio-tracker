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
        const portfolio = await prisma.portfolio.findUnique({
            where: { id: portfolioId }
        });

        if (!portfolio) {
            return { success: false, error: "Portfolio not found" };
        }

        const transactions = await prisma.transaction.findMany({
            where: { portfolioId },
            include: { asset: true },
            orderBy: { date: 'asc' } // Critical for running balance
        });

        let totalInvested = 0;
        let totalInvestedEUR = 0;
        let totalInvestedUSD = 0;
        let cashBalance = 0;
        const holdings = new Map<string, number>();
        const prices = new Map<string, number>();

        for (const tx of transactions) {
            // Update prices map if available
            if (tx.asset && tx.asset.currentPrice) {
                prices.set(tx.asset.symbol, tx.asset.currentPrice);
            }

            const totalCost = tx.amount + (tx.fee || 0);

            // Helper to track original currency investment
            // If originalCurrency doesn't exist (legacy), we assume it matched the portfolio currency (e.g. USD if portfolio is USD)
            // Or we just skip it.
            const addToInvestedCurrency = (amount: number, currency?: string | null) => {
                const curr = currency || portfolio.currency;
                if (curr === 'EUR') totalInvestedEUR += amount;
                if (curr === 'USD') totalInvestedUSD += amount;
            }

            switch (tx.type) {
                case "DEPOSIT":
                case "GIFT":
                    cashBalance += tx.amount;
                    totalInvested += tx.amount;
                    if (tx.originalAmount) {
                        addToInvestedCurrency(tx.originalAmount, tx.originalCurrency);
                    } else {
                        // Fallback for legacy data (convert back using rate?) or just use current amount
                        // If we didn't store original, we might assume amount/exchangeRate is close.
                        // For now, let's treat legacy as:
                        addToInvestedCurrency(tx.amount / (tx.exchangeRate || 1.0), portfolio.currency);
                        // Note: this logic might be imperfect for cross-currency legacy, but improved for new ones.
                    }
                    break;
                case "WITHDRAWAL":
                    cashBalance -= tx.amount;
                    totalInvested -= tx.amount;
                    // Reducing invested capital from original currency bucket is tricky without knowing WHICH bucket.
                    // Simplified: We don't reduce the "Total Invested History" usually, but here 'totalInvested' is 'Net Invested'.
                    // Let's approximate deduction pro-rata or just from the transaction's currency if known.
                    if (tx.originalAmount) {
                        addToInvestedCurrency(-tx.originalAmount, tx.originalCurrency);
                    } else {
                        addToInvestedCurrency(-(tx.amount / (tx.exchangeRate || 1.0)), portfolio.currency);
                    }
                    break;
                case "BUY":
                    // Check if we have enough cash
                    const cost = totalCost;
                    cashBalance -= cost;

                    // Implicit Deposit logic:
                    if (cashBalance < 0) {
                        const shortage = Math.abs(cashBalance);
                        totalInvested += shortage;
                        cashBalance = 0;
                    }

                    if (tx.assetSymbol && tx.quantity) {
                        const current = holdings.get(tx.assetSymbol) || 0;
                        holdings.set(tx.assetSymbol, current + tx.quantity);
                    }
                    break;
                case "SELL":
                    // For SELL, amount is usually the proceeds (Cash needed to be added)
                    // If fee is stored separately, we might need to subtract it if 'amount' is gross.
                    // Assuming 'amount' is net proceeds for now or following previous pattern.
                    // In previous step I saw: const proceed = tx.amount - (tx.fee || 0);
                    const proceed = tx.amount - (tx.fee || 0);
                    cashBalance += proceed;

                    if (tx.assetSymbol && tx.quantity) {
                        const current = holdings.get(tx.assetSymbol) || 0;
                        holdings.set(tx.assetSymbol, Math.max(0, current - tx.quantity));
                    }
                    break;
                case "DIVIDEND":
                    cashBalance += tx.amount;
                    break;
                case "SAVEBACK":
                case "ROUNDUP":
                    // Treated as immediate investment of a gift
                    totalInvested += tx.amount;
                    // Add to invested breakdown (usually these are in portfolio currency, e.g. EUR for TradeRepublic? or USD?)
                    // Assuming they are in portfolio currency for now.
                    addToInvestedCurrency(tx.amount / (tx.exchangeRate || 1.0), portfolio.currency);

                    if (tx.assetSymbol && tx.quantity) {
                        const current = holdings.get(tx.assetSymbol) || 0;
                        holdings.set(tx.assetSymbol, current + tx.quantity);
                    }
                    break;
            }
        }

        // Implicit deposit logic from BUY loop above needs to be accounted for in Total Invested Breakdown too?
        // The simple 'totalInvested' var already captures it.
        // But our split variables (EUR/USD) might miss the implicit deposits if we don't catch them.
        // We'd need to assume implicit deposits are in the Portfolio Currency.
        if (totalInvested > (totalInvestedEUR + totalInvestedUSD)) {
            // Gap is likely implicit deposits or legacy data
            const gap = totalInvested - (totalInvestedEUR + totalInvestedUSD);
            // Assign gap to portfolio currency
            addToInvestedCurrency(gap, portfolio.currency);
        }

        // Calculate Market Value
        let assetsValue = 0;
        holdings.forEach((qty, symbol) => {
            const price = prices.get(symbol) || 0;
            assetsValue += qty * price;
        });

        const currentValue = cashBalance + assetsValue; // Total Portfolio Value
        const totalGain = currentValue - totalInvested;
        const totalGainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

        return {
            success: true,
            data: {
                totalInvested,
                totalInvestedEUR,
                totalInvestedUSD,
                cashBalance,
                assetsValue,
                currentValue,
                totalGain,
                totalGainPercent,
                currency: portfolio.currency
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
