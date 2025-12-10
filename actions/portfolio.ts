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

        // Helper to track original currency investment
        // If originalCurrency doesn't exist (legacy), we assume it matched the portfolio currency (e.g. USD if portfolio is USD)
        // Or we just skip it.
        const addToInvestedCurrency = (amount: number, currency?: string | null) => {
            const curr = currency || portfolio.currency;
            if (curr === 'EUR') totalInvestedEUR += amount;
            if (curr === 'USD') totalInvestedUSD += amount;
        };

        for (const tx of transactions) {
            // Update prices map if available
            if (tx.asset && tx.asset.currentPrice) {
                prices.set(tx.asset.symbol, tx.asset.currentPrice);
            }

            const totalCost = tx.amount + (tx.fee || 0);

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

            // Get asset info to check if currency conversion is needed
            const assetInfo = transactions.find(tx => tx.assetSymbol === symbol)?.asset;
            let priceInPortfolioCurrency = price;

            if (assetInfo && assetInfo.quoteCurrency && assetInfo.quoteCurrency !== portfolio.currency) {
                // Asset trades in different currency, need to convert
                let exchangeRate = 1.0;
                if (portfolio.currency === 'USD' && assetInfo.exchangeRateToUSD) {
                    exchangeRate = assetInfo.exchangeRateToUSD;
                } else if (portfolio.currency === 'EUR' && assetInfo.exchangeRateToEUR) {
                    exchangeRate = assetInfo.exchangeRateToEUR;
                }
                priceInPortfolioCurrency = price * exchangeRate;
            }

            assetsValue += qty * priceInPortfolioCurrency;
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

export async function getAssetBreakdown(portfolioId: string) {
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
            orderBy: { date: 'asc' }
        });

        // Map to track per-asset data
        const assetData = new Map<string, {
            symbol: string;
            name: string;
            quantity: number;
            totalCost: number;
            totalSoldCost: number; // Cost basis of sold shares
            realizedGain: number;
            dividends: number;
            currentPrice: number;
            firstPurchaseDate: Date | null;
        }>();

        for (const tx of transactions) {
            if (!tx.assetSymbol) continue;

            // Initialize asset data if not exists
            if (!assetData.has(tx.assetSymbol)) {
                assetData.set(tx.assetSymbol, {
                    symbol: tx.assetSymbol,
                    name: tx.asset?.name || tx.assetSymbol,
                    quantity: 0,
                    totalCost: 0,
                    totalSoldCost: 0,
                    realizedGain: 0,
                    dividends: 0,
                    currentPrice: tx.asset?.currentPrice || 0,
                    firstPurchaseDate: null
                });
            }

            const data = assetData.get(tx.assetSymbol)!;

            switch (tx.type) {
                case "BUY":
                case "SAVEBACK":
                case "ROUNDUP":
                    if (tx.quantity) {
                        data.quantity += tx.quantity;
                        data.totalCost += tx.amount + (tx.fee || 0);

                        // Track first purchase date
                        if (!data.firstPurchaseDate || tx.date < data.firstPurchaseDate) {
                            data.firstPurchaseDate = tx.date;
                        }
                    }
                    break;

                case "SELL":
                    if (tx.quantity) {
                        // Calculate average cost per share before this sale
                        const avgCostPerShare = data.quantity > 0 ? data.totalCost / data.quantity : 0;

                        // Cost basis of shares being sold
                        const soldCost = avgCostPerShare * tx.quantity;
                        data.totalSoldCost += soldCost;

                        // Realized gain = proceeds - cost basis - fees
                        const proceeds = tx.amount - (tx.fee || 0);
                        data.realizedGain += proceeds - soldCost;

                        // Update quantity and remaining cost
                        data.quantity -= tx.quantity;
                        data.totalCost -= soldCost;

                        // Ensure no negative values due to rounding
                        if (data.quantity < 0.00001) {
                            data.quantity = 0;
                            data.totalCost = 0;
                        }
                    }
                    break;

                case "DIVIDEND":
                    data.dividends += tx.amount;
                    break;
            }

            // Update current price if available
            if (tx.asset?.currentPrice) {
                data.currentPrice = tx.asset.currentPrice;
            }
        }

        // Convert to array and calculate final metrics
        const breakdown = Array.from(assetData.values())
            .filter(asset => asset.quantity > 0 || asset.realizedGain !== 0 || asset.dividends !== 0)
            .map(asset => {
                // Get the asset's quote currency and exchange rate
                const assetRecord = transactions.find(tx => tx.assetSymbol === asset.symbol)?.asset;
                const quoteCurrency = assetRecord?.quoteCurrency || portfolio.currency;

                // Determine exchange rate to portfolio currency
                let exchangeRate = 1.0;
                if (quoteCurrency !== portfolio.currency) {
                    if (portfolio.currency === 'USD') {
                        exchangeRate = assetRecord?.exchangeRateToUSD || 1.0;
                    } else if (portfolio.currency === 'EUR') {
                        exchangeRate = assetRecord?.exchangeRateToEUR || 1.0;
                    }
                }

                // Convert current price to portfolio currency
                const priceInPortfolioCurrency = asset.currentPrice * exchangeRate;
                const currentValue = asset.quantity * priceInPortfolioCurrency;

                const unrealizedGain = currentValue - asset.totalCost;
                const unrealizedGainPercent = asset.totalCost > 0 ? (unrealizedGain / asset.totalCost) * 100 : 0;
                const avgCostPerShare = asset.quantity > 0 ? asset.totalCost / asset.quantity : 0;
                const totalGain = asset.realizedGain + unrealizedGain;

                return {
                    symbol: asset.symbol,
                    name: asset.name,
                    quantity: asset.quantity,
                    currentPrice: asset.currentPrice, // Native currency price
                    currentPriceConverted: priceInPortfolioCurrency, // Converted to portfolio currency
                    quoteCurrency, // Currency the asset trades in
                    exchangeRate, // Exchange rate used
                    avgCostPerShare,
                    totalCost: asset.totalCost,
                    currentValue,
                    unrealizedGain,
                    unrealizedGainPercent,
                    realizedGain: asset.realizedGain,
                    totalGain,
                    dividends: asset.dividends,
                    firstPurchaseDate: asset.firstPurchaseDate,
                };
            });

        // Calculate total portfolio value for allocation percentages
        const totalValue = breakdown.reduce((sum, asset) => sum + asset.currentValue, 0);

        // Add allocation percentage
        const breakdownWithAllocation = breakdown.map(asset => ({
            ...asset,
            allocationPercent: totalValue > 0 ? (asset.currentValue / totalValue) * 100 : 0
        }));

        // Sort by current value descending
        breakdownWithAllocation.sort((a, b) => b.currentValue - a.currentValue);

        return {
            success: true,
            data: breakdownWithAllocation
        };

    } catch (error) {
        console.error("Error calculating asset breakdown:", error);
        return { success: false, error: "Failed to calculate asset breakdown" };
    }
}

export async function getPortfolioHistory(portfolioId: string) {
    try {
        const portfolio = await prisma.portfolio.findUnique({
            where: { id: portfolioId }
        });

        if (!portfolio) {
            return { success: false, error: "Portfolio not found" };
        }

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
                const price = prices.get(symbol) || 0;

                // Get asset info to check if currency conversion is needed
                const assetInfo = transactions.find(tx => tx.assetSymbol === symbol)?.asset;
                let priceInPortfolioCurrency = price;

                if (assetInfo && assetInfo.quoteCurrency && assetInfo.quoteCurrency !== portfolio.currency) {
                    // Asset trades in different currency, need to convert
                    let exchangeRate = 1.0;
                    if (portfolio.currency === 'USD' && assetInfo.exchangeRateToUSD) {
                        exchangeRate = assetInfo.exchangeRateToUSD;
                    } else if (portfolio.currency === 'EUR' && assetInfo.exchangeRateToEUR) {
                        exchangeRate = assetInfo.exchangeRateToEUR;
                    }
                    priceInPortfolioCurrency = price * exchangeRate;
                }

                val += qty * priceInPortfolioCurrency;
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
