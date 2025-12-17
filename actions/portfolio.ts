"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getHistoricalPrices } from "./asset";
import { getExchangeRate } from "@/lib/exchange-rates";
import { auth } from "@/auth";

export async function createPortfolio(name: string, currency: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Unauthorized" };
        }

        const portfolio = await prisma.portfolio.create({
            data: {
                name,
                currency,
                userId: session.user.id,
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
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, data: [] };
        }

        const portfolios = await prisma.portfolio.findMany({
            where: {
                userId: session.user.id,
            },
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
        const holdings = new Map<string, { qty: number, cost: number }>();
        const prices = new Map<string, number>();
        let realizedGains = 0;
        let totalDividends = 0;
        let totalFees = 0;
        let explicitInvested = 0;

        // Helper to track original currency investment
        const addToInvestedCurrency = (amount: number, currency?: string | null) => {
            const curr = currency || portfolio.currency;
            if (curr === 'EUR') totalInvestedEUR += amount;
            if (curr === 'USD') totalInvestedUSD += amount;
        };

        // Fetch generic USD -> Portfolio Currency rate for pivot conversions
        const usdToPortfolioRate = await getExchangeRate("USD", portfolio.currency);

        for (const tx of transactions) {
            // Update prices map if available
            if (tx.asset && tx.asset.currentPrice) {
                prices.set(tx.asset.symbol, tx.asset.currentPrice);
            }

            const fee = tx.fee || 0;
            totalFees += fee;
            const totalCost = tx.amount + fee;

            switch (tx.type) {
                case "DEPOSIT":
                case "GIFT":
                    cashBalance += tx.amount;
                    totalInvested += tx.amount;
                    explicitInvested += tx.amount;
                    if (tx.originalAmount) {
                        addToInvestedCurrency(tx.originalAmount, tx.originalCurrency);
                    } else {
                        addToInvestedCurrency(tx.amount / (tx.exchangeRate || 1.0), portfolio.currency);
                    }
                    break;
                case "WITHDRAWAL":
                    cashBalance -= tx.amount;
                    totalInvested -= tx.amount;
                    explicitInvested -= tx.amount;
                    if (tx.originalAmount) {
                        addToInvestedCurrency(-tx.originalAmount, tx.originalCurrency);
                    } else {
                        addToInvestedCurrency(-(tx.amount / (tx.exchangeRate || 1.0)), portfolio.currency);
                    }
                    break;
                case "BUY":
                    cashBalance -= totalCost;
                    if (tx.assetSymbol) {
                        const current = holdings.get(tx.assetSymbol) || { qty: 0, cost: 0 };
                        holdings.set(tx.assetSymbol, {
                            qty: current.qty + (tx.quantity || 0),
                            cost: current.cost + totalCost
                        });
                    }
                    break;
                case "SELL":
                    const proceed = tx.amount - (tx.fee || 0);
                    cashBalance += proceed;

                    if (tx.assetSymbol && tx.quantity) {
                        const current = holdings.get(tx.assetSymbol) || { qty: 0, cost: 0 };
                        if (current.qty > 0) {
                            const avgCost = current.cost / current.qty;
                            const costOfSold = avgCost * tx.quantity;
                            const gain = proceed - costOfSold; // Realized Gain
                            realizedGains += gain;

                            holdings.set(tx.assetSymbol, {
                                qty: Math.max(0, current.qty - tx.quantity),
                                cost: Math.max(0, current.cost - costOfSold)
                            });
                        }
                    }
                    break;
                case "DIVIDEND":
                    cashBalance += tx.amount;
                    totalDividends += tx.amount;
                    break;
                case "SAVEBACK":
                case "ROUNDUP":
                    totalInvested += tx.amount;
                    explicitInvested += tx.amount;
                    addToInvestedCurrency(tx.amount / (tx.exchangeRate || 1.0), portfolio.currency);
                    if (tx.assetSymbol && tx.quantity) {
                        const current = holdings.get(tx.assetSymbol) || { qty: 0, cost: 0 };
                        holdings.set(tx.assetSymbol, {
                            qty: current.qty + tx.quantity,
                            cost: current.cost + tx.amount
                        });
                    }
                    break;
            }
        }

        // Implicit deposit check for currency consistency
        if (totalInvested > (totalInvestedEUR + totalInvestedUSD)) {
            const gap = totalInvested - (totalInvestedEUR + totalInvestedUSD);
            addToInvestedCurrency(gap, portfolio.currency);
        }

        // Calculate Market Value
        let assetsValue = 0;
        holdings.forEach((data, symbol) => {
            const price = prices.get(symbol) || 0;

            // Get asset info to check if currency conversion is needed
            const assetInfo = transactions.find(tx => tx.assetSymbol === symbol)?.asset;
            let priceInPortfolioCurrency = price;

            if (assetInfo) {
                let effectivePrice = price;
                if (assetInfo.quoteCurrency === 'GBX' || assetInfo.quoteCurrency === 'GBp') {
                    effectivePrice = price / 100;
                }

                if (assetInfo.quoteCurrency && assetInfo.quoteCurrency !== portfolio.currency) {
                    // Asset trades in different currency, need to convert
                    let exchangeRate = 1.0;

                    if (portfolio.currency === 'USD' && assetInfo.exchangeRateToUSD) {
                        exchangeRate = assetInfo.exchangeRateToUSD;
                    } else if (portfolio.currency === 'EUR' && assetInfo.exchangeRateToEUR) {
                        exchangeRate = assetInfo.exchangeRateToEUR;
                    } else if (assetInfo.exchangeRateToUSD) {
                        // Pivot Strategy: Asset -> USD -> Portfolio
                        exchangeRate = assetInfo.exchangeRateToUSD * usdToPortfolioRate;
                    }

                    priceInPortfolioCurrency = effectivePrice * exchangeRate;
                } else {
                    priceInPortfolioCurrency = effectivePrice;
                }
            }

            assetsValue += data.qty * priceInPortfolioCurrency;
        });

        // Apply User Request: Net Invested = Deposits + Gifts +/- Realized + Dividends - Fees
        // Using explicitInvested (Net Deposits) to avoid counting implicit shortages caused by fee timing.
        const netInvested = explicitInvested + realizedGains + totalDividends - totalFees;

        console.log(`[PortfolioSummary] Invested: ${totalInvested}, Realized: ${realizedGains}, Divs: ${totalDividends}, Fees: ${totalFees} => Net: ${netInvested}`);



        const currentValue = cashBalance + assetsValue; // Total Portfolio Value
        const totalGain = currentValue - explicitInvested;
        const totalGainPercent = explicitInvested > 0 ? (totalGain / explicitInvested) * 100 : 0;

        // Calculate Value in EUR for display
        const portfolioToEURRate = await getExchangeRate(portfolio.currency, "EUR");
        const currentValueEUR = currentValue * portfolioToEURRate;
        const realizedGainsEUR = realizedGains * portfolioToEURRate;
        const totalInvestedConvertedEUR = explicitInvested * portfolioToEURRate;

        return {
            success: true,
            data: {
                totalInvested: explicitInvested,
                totalInvestedEUR, // This was tracking specific EUR deposits, but effectively we want total invested value in EUR
                totalInvestedConvertedEUR, // Total invested amount converted to EUR at current rate
                totalInvestedUSD,
                cashBalance,
                assetsValue,
                currentValue,
                currentValueEUR,
                totalGain,
                totalGainPercent,
                realizedGains,
                realizedGainsEUR,
                currency: portfolio.currency,
                transactionCount: transactions.length
            }
        };

    } catch (error) {
        console.error("Error calculating summary:", error);
        return { success: false, error: "Failed to calculate summary" };
    }
}

export async function getDashboardSummary() {
    try {
        const portfoliosRes = await getPortfolios();
        if (!portfoliosRes.success || !portfoliosRes.data) {
            return {
                success: false,
                data: {
                    totalBalanceEUR: 0,
                    totalInvestedEUR: 0,
                    totalRealizedPLEUR: 0,
                    totalGainEUR: 0,
                    totalGainPercent: 0,
                    portfolios: []
                }
            };
        }

        const summaries = await Promise.all(
            portfoliosRes.data.map(p => getPortfolioSummary(p.id))
        );

        let totalBalanceEUR = 0;
        let totalInvestedEUR = 0;
        let totalRealizedPLEUR = 0;
        // let totalGainEUR = 0;
        const detailedPortfolios = [];

        for (let i = 0; i < summaries.length; i++) {
            const res = summaries[i];
            const portfolio = portfoliosRes.data[i];

            if (res.success && res.data) {
                totalBalanceEUR += res.data.currentValueEUR || 0;

                // Prioritize explicit EUR investment (historical cost) if available
                if ((res.data.totalInvestedEUR || 0) > 0) {
                    totalInvestedEUR += res.data.totalInvestedEUR || 0;
                } else {
                    // Fallback to converted value
                    totalInvestedEUR += res.data.totalInvestedConvertedEUR || 0;
                }

                totalRealizedPLEUR += res.data.realizedGainsEUR || 0;

                detailedPortfolios.push({
                    id: portfolio.id,
                    name: portfolio.name,
                    currency: portfolio.currency,
                    currentValue: res.data.currentValue,
                    transactionCount: res.data.transactionCount || 0
                });
            } else {
                // Push basic info if summary failed
                detailedPortfolios.push({
                    id: portfolio.id,
                    name: portfolio.name,
                    currency: portfolio.currency,
                    currentValue: 0,
                    transactionCount: 0
                });
            }
        }

        const totalGainEUR = totalBalanceEUR - totalInvestedEUR;
        const totalGainPercent = totalInvestedEUR > 0 ? (totalGainEUR / totalInvestedEUR) * 100 : 0;

        return {
            success: true,
            data: {
                totalBalanceEUR,
                totalInvestedEUR,
                totalRealizedPLEUR,
                totalGainEUR,
                totalGainPercent,
                portfolios: detailedPortfolios
            }
        };

    } catch (error) {
        console.error("Error calculating dashboard summary:", error);
        return { success: false, error: "Failed to calculate dashboard summary" };
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
            assetClass: string; // Add this
            quantity: number;
            totalCost: number;
            totalSoldCost: number; // Cost basis of sold shares
            realizedGain: number;
            dividends: number;
            currentPrice: number;
            firstPurchaseDate: Date | null;
            transactions: typeof transactions;
        }>();

        for (const tx of transactions) {
            if (!tx.assetSymbol) continue;

            // Initialize asset data if not exists
            if (!assetData.has(tx.assetSymbol)) {
                assetData.set(tx.assetSymbol, {
                    symbol: tx.assetSymbol,
                    name: tx.asset?.name || tx.assetSymbol,
                    assetClass: tx.asset?.assetClass || "EQUITY", // Add this
                    quantity: 0,
                    totalCost: 0,
                    totalSoldCost: 0,
                    realizedGain: 0,
                    dividends: 0,
                    currentPrice: tx.asset?.currentPrice || 0,
                    firstPurchaseDate: null,
                    transactions: [] as typeof transactions
                });
            }

            const data = assetData.get(tx.assetSymbol)!;
            data.transactions.push(tx);

            switch (tx.type) {
                case "BUY":
                case "SAVEBACK":
                case "ROUNDUP":
                    data.quantity += (tx.quantity || 0);
                    data.totalCost += tx.amount + (tx.fee || 0);

                    // Track first purchase date
                    if (!data.firstPurchaseDate || tx.date < data.firstPurchaseDate) {
                        data.firstPurchaseDate = tx.date;
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

        // Fetch generic USD -> Portfolio Currency rate for pivot conversions
        const usdToPortfolioRate = await getExchangeRate("USD", portfolio.currency);

        // Convert to array and calculate final metrics
        const breakdown = Array.from(assetData.values())
            .filter(asset => asset.quantity > 0 || asset.realizedGain !== 0 || asset.dividends !== 0)
            .map(asset => {
                // Get the asset's quote currency and exchange rate
                const assetRecord = transactions.find(tx => tx.assetSymbol === asset.symbol)?.asset;
                const quoteCurrency = assetRecord?.quoteCurrency || portfolio.currency;

                // Determine exchange rate to portfolio currency
                let exchangeRate = 1.0;
                let effectivePrice = asset.currentPrice;

                if (quoteCurrency === 'GBX' || quoteCurrency === 'GBp') {
                    effectivePrice = asset.currentPrice / 100;
                }

                if (quoteCurrency !== portfolio.currency) {
                    if (portfolio.currency === 'USD') {
                        exchangeRate = assetRecord?.exchangeRateToUSD || 1.0;
                    } else if (portfolio.currency === 'EUR') {
                        exchangeRate = assetRecord?.exchangeRateToEUR || 1.0;
                    } else if (assetRecord?.exchangeRateToUSD) {
                        // Pivot Logic
                        exchangeRate = assetRecord.exchangeRateToUSD * usdToPortfolioRate;
                    }
                }

                // Convert current price to portfolio currency
                const priceInPortfolioCurrency = effectivePrice * exchangeRate;
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
                    assetClass: asset.assetClass, // Add this
                    firstPurchaseDate: asset.firstPurchaseDate,
                    transactions: asset.transactions.sort((a, b) => b.date.getTime() - a.date.getTime()) // Newest first
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

        const firstDate = new Date(transactions[0].date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Fetch historical prices for all assets
        const uniqueAssets = Array.from(new Set(
            transactions
                .map(t => t.assetSymbol)
                .filter(s => s !== null)
        )) as string[];

        console.log(`[History] Fetching history for assets: ${uniqueAssets.join(", ")}`);

        // Fetch prices from a bit before first date to ensure we have a starting price if needed
        const fetchStartDate = new Date(firstDate);
        fetchStartDate.setDate(fetchStartDate.getDate() - 5);

        const priceHistories = new Map<string, Map<string, number>>();

        await Promise.all(uniqueAssets.map(async (symbol) => {
            const history = await getHistoricalPrices(symbol, fetchStartDate, today);
            priceHistories.set(symbol, history);
        }));

        // 2. Build Daily History
        let currentDate = new Date(firstDate);
        currentDate.setHours(0, 0, 0, 0);

        const points = new Map<string, { invested: number, value: number }>();
        const holdings = new Map<string, number>();
        let invested = 0;
        let cashBalance = 0; // Track cash if we want Total Value = Cash + Assets. 
        // But usually "Performance" graph is Total Portfolio Value.
        // Transactions track cash flow.

        // Pre-calculate USD/EUR rate history? 
        // For simplicity, we might use current exchange rate or fetch history if critical.
        // Let's use current rate for now to avoid complexity explosion, 
        // acknowledging roughly correct for recent past, might diverge for 2010.
        // A better approach is storing the historical exchange rate in the Transaction or fetching it.
        const usdToPortfolioRate = await getExchangeRate("USD", portfolio.currency);

        const lastKnownPrices = new Map<string, number>();

        while (currentDate <= today) {
            const dateStr = currentDate.toISOString().split('T')[0];

            // Apply transactions for this day
            // We use filtered list to optimize? No, just iterate linear is fine for < 10k txs.
            // Better: pointer to transactions array.

            // Note: transactions are ordered by date.
            // But we need to handle multiple transactions per day.

            const dayTransactions = transactions.filter(t => {
                const tDate = new Date(t.date);
                tDate.setHours(0, 0, 0, 0);
                return tDate.getTime() === currentDate.getTime();
            });

            for (const tx of dayTransactions) {
                // Update invested (Cost Basis / Net Inflow)
                // Logic: "Invested" usually means Net Deposit.
                // If I buy, Invested doesn't change (Cash -> Asset).
                // If I Deposit, Invested increases.
                // Let's align with Summary logic:

                switch (tx.type) {
                    case "DEPOSIT":
                    case "GIFT":
                        invested += tx.amount;
                        cashBalance += tx.amount;
                        break;
                    case "WITHDRAWAL":
                        invested -= tx.amount;
                        cashBalance -= tx.amount;
                        break;
                    case "BUY":
                        // Buying (Cash -> Asset). 
                        // Invested (Net Deposit) stays same.
                        // Cash decreases.
                        cashBalance -= (tx.amount + (tx.fee || 0));
                        if (tx.assetSymbol && tx.quantity) {
                            holdings.set(tx.assetSymbol, (holdings.get(tx.assetSymbol) || 0) + tx.quantity);
                        }
                        break;
                    case "SELL":
                        // Selling (Asset -> Cash).
                        // Invested stays same.
                        // Cash increases.
                        cashBalance += (tx.amount - (tx.fee || 0));
                        if (tx.assetSymbol && tx.quantity) {
                            holdings.set(tx.assetSymbol, (holdings.get(tx.assetSymbol) || 0) - tx.quantity);
                        }
                        break;
                    case "DIVIDEND":
                        // Cash increases.
                        // Invested? Dividend is "Return", so Net Invested shouldn't change?
                        // OR implies we have more cash without depositing. 
                        // Usually Dividend is essentially "Profit realized as Cash".
                        // If we track "Net Invested", Dividend does not increase it on its own.
                        cashBalance += tx.amount;
                        break;
                    case "SAVEBACK":
                    case "ROUNDUP":
                        // External money coming in (like Reward).
                        // Treated as Deposit or "Gift".
                        invested += tx.amount; // It's new money added to the cost basis
                        // But it's immediately used to buy asset (usually).
                        // If logic says "Saveback" is money from bank -> Asset.
                        // So Invested += amount. 
                        // And Holdings += quantity.
                        if (tx.assetSymbol && tx.quantity) {
                            holdings.set(tx.assetSymbol, (holdings.get(tx.assetSymbol) || 0) + tx.quantity);
                        }
                        break;
                }
            }

            // Calculate Value for this day
            let assetsValue = 0;

            holdings.forEach((qty, symbol) => {
                if (qty <= 0) return;

                // Lookup price
                const history = priceHistories.get(symbol);
                let price = history?.get(dateStr);

                // Fallback to last known price
                if (price === undefined) {
                    price = lastKnownPrices.get(symbol);
                }

                // If still no price (e.g. weekend/before history start), try closest previous?
                // The history map should utilize filling or we do it here.
                // Assuming `getHistoricalPrices` returns traded days.
                // If undefined, retain lastKnown.

                if (price !== undefined) {
                    lastKnownPrices.set(symbol, price);

                    // Conversion logic (Simplified using current rate - risky for long history but acceptable for now)
                    // TODO: Improve with historical FX rates

                    // Check asset currency
                    // We need `asset` info. We have it from `transactions` (find any tx with this symbol).
                    const assetInfo = transactions.find(t => t.assetSymbol === symbol)?.asset;

                    let effectivePrice = price; // In quote currency

                    if (assetInfo) {
                        if (assetInfo.quoteCurrency === 'GBX' || assetInfo.quoteCurrency === 'GBp') {
                            effectivePrice = price / 100;
                        }

                        // FX Conversion
                        // We use the static rates from assetInfo (current rates) or global fallback
                        // Ideally we'd have historical FX.

                        if (assetInfo.quoteCurrency && assetInfo.quoteCurrency !== portfolio.currency) {
                            let exchangeRate = 1.0;
                            // Approximating using CURRENT rates store in Asset. 
                            // This causes inaccuracies for past years if FX moved a lot.
                            // But better than nothing.
                            if (portfolio.currency === 'USD' && assetInfo.exchangeRateToUSD) {
                                exchangeRate = assetInfo.exchangeRateToUSD;
                            } else if (portfolio.currency === 'EUR' && assetInfo.exchangeRateToEUR) {
                                exchangeRate = assetInfo.exchangeRateToEUR;
                            } else if (assetInfo.exchangeRateToUSD) {
                                exchangeRate = assetInfo.exchangeRateToUSD * usdToPortfolioRate;
                            }
                            effectivePrice = effectivePrice * exchangeRate;
                        }
                    }

                    assetsValue += qty * effectivePrice;
                } else {
                    // No price known at all?
                    // Maybe use purchase price from transaction if available?
                    // Complex to lookup "Last Buy Price".
                    // Ignore for now or assume 0 (which causes drop).
                    // Or search forward? No, look for any price in history?
                    // Use 0 safer than noise.
                }
            });

            const totalValue = cashBalance + assetsValue;

            // Correction: If totalValue < 0 (due to margin/shorting or bad data), clamp?
            // Just record it.

            points.set(dateStr, {
                invested,
                value: totalValue
            });

            currentDate.setDate(currentDate.getDate() + 1);
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

export async function getPeriodPerformance(portfolioId: string) {
    try {
        const historyRes = await getPortfolioHistory(portfolioId);
        if (!historyRes.success || !historyRes.data) {
            return { success: false, error: historyRes.error || "Failed to fetch history" };
        }

        const data = historyRes.data;
        if (data.length === 0) return { success: true, data: { yearly: [], monthly: {} } };

        // Helper to get Year/Month keys
        const getYear = (d: string) => d.split('-')[0];
        const getMonth = (d: string) => d.substring(0, 7); // "YYYY-MM"

        const points = data;

        // Group points by Year and Month
        const years = Array.from(new Set(points.map(p => getYear(p.date)))).sort();

        const yearlyPerformance = [];
        const monthlyPerformance: Record<string, any[]> = {};

        // 1. Calculate Yearly Performance
        for (const year of years) {
            const yearPoints = points.filter(p => getYear(p.date) === year);
            if (yearPoints.length === 0) continue;

            const start = yearPoints[0];
            const end = yearPoints[yearPoints.length - 1];

            // Find last point of previous year
            const prevYearLastPoint = points.filter(p => getYear(p.date) < year).pop();

            const startValue = prevYearLastPoint ? prevYearLastPoint.value : 0;
            const startInvested = prevYearLastPoint ? prevYearLastPoint.invested : 0;

            const endValue = end.value;
            const endInvested = end.invested;

            const netInvestedChange = endInvested - startInvested;
            const valueChange = endValue - startValue;

            const gain = valueChange - netInvestedChange;
            // Simple ROI logic
            const avgInvested = (startInvested + endInvested) / 2;
            const roi = avgInvested > 0 ? (gain / avgInvested) * 100 : 0;

            yearlyPerformance.push({
                period: year,
                gain,
                roi,
                invested: endInvested,
                value: endValue
            });

            // 2. Calculate Monthly Performance for this year
            const months = Array.from(new Set(yearPoints.map(p => getMonth(p.date)))).sort();
            monthlyPerformance[year] = [];

            for (const month of months) {
                const monthPoints = yearPoints.filter(p => getMonth(p.date) === month);
                const mEnd = monthPoints[monthPoints.length - 1];

                // Find start reference (last point of prev month)
                const prevMonthLastPoint = points.filter(p => p.date < monthPoints[0].date).pop();

                const mStartValue = prevMonthLastPoint ? prevMonthLastPoint.value : 0;
                const mStartInvested = prevMonthLastPoint ? prevMonthLastPoint.invested : 0;

                const mEndValue = mEnd.value;
                const mEndInvested = mEnd.invested;

                const mNetFlow = mEndInvested - mStartInvested;
                const mValChange = mEndValue - mStartValue;
                const mGain = mValChange - mNetFlow;

                const mAvgInvested = (mStartInvested + mEndInvested) / 2;
                const mRoi = mAvgInvested > 0 ? (mGain / mAvgInvested) * 100 : 0;

                const monthName = new Date(month + "-01").toLocaleString('default', { month: 'short' });

                monthlyPerformance[year].push({
                    period: monthName,
                    fullPeriod: month,
                    gain: mGain,
                    roi: mRoi,
                    invested: mEndInvested,
                    value: mEndValue
                });
            }
        }

        return {
            success: true,
            data: {
                yearly: yearlyPerformance,
                monthly: monthlyPerformance
            }
        };

    } catch (error) {
        console.error("Error calculating period performance:", error);
        return { success: false, error: "Failed to calculate performance" };
    }
}
