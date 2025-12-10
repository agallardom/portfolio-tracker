"use server";

import { prisma } from "@/lib/db";
import YahooFinance from "yahoo-finance2";
import { revalidatePath } from "next/cache";
import { getExchangeRates } from "@/lib/exchange-rates";

const yahooFinance = new YahooFinance();

export async function updatePortfolioPrices(portfolioId: string) {
    try {
        console.log(`[Price Update] Starting update for portfolio: ${portfolioId}`);
        // 1. Get all unique assets in the portfolio
        const transactions = await prisma.transaction.findMany({
            where: {
                portfolioId,
                assetSymbol: { not: null }
            },
            select: { assetSymbol: true },
            distinct: ['assetSymbol']
        });

        const symbols = transactions
            .map(t => t.assetSymbol)
            .filter((s): s is string => s !== null);

        console.log(`[Price Update] Found symbols to update:`, symbols);

        if (symbols.length === 0) {
            return { success: true, message: "No assets to update" };
        }

        // 2. Fetch prices
        // yahoo-finance2 quote can take an array, but let's do it safely? 
        // No, strict typing says `quote` takes string. `quoteSummary` takes string.
        // It has `quote` that can take array? simpler to loop or Promise.all for now or check docs.
        // Doing Promise.allSettled avoids one failure breaking all.

        // However, yahoo-finance2 often prefers single requests or batching is specific.
        // For simplicity and robustness:

        const results = await Promise.all(symbols.map(async (symbol) => {
            try {
                // Heuristic: symbols might need suffix (e.g. .MC for Madrid). 
                // We assume user entered correct Yahoo symbols for now.
                const quote = await yahooFinance.quote(symbol);
                if (quote && quote.regularMarketPrice) {
                    const price = quote.regularMarketPrice;
                    const quoteCurrency = quote.currency || 'USD'; // Default to USD if not specified

                    console.log(`[Price Update] ${symbol}: ${price} ${quoteCurrency}`);

                    // Fetch exchange rates for this currency
                    let exchangeRateToUSD = 1.0;
                    let exchangeRateToEUR = 1.0;

                    if (quoteCurrency !== 'USD' && quoteCurrency !== 'EUR') {
                        try {
                            const rates = await getExchangeRates(quoteCurrency);
                            exchangeRateToUSD = rates.toUSD;
                            exchangeRateToEUR = rates.toEUR;
                            console.log(`[Exchange Rates] ${quoteCurrency}: USD=${exchangeRateToUSD}, EUR=${exchangeRateToEUR}`);
                        } catch (rateError) {
                            console.warn(`[Exchange Rates] Failed to fetch rates for ${quoteCurrency}, using 1.0`);
                        }
                    } else if (quoteCurrency === 'USD') {
                        exchangeRateToUSD = 1.0;
                        // Fetch EUR rate for USD
                        try {
                            const rates = await getExchangeRates('USD');
                            exchangeRateToEUR = rates.toEUR;
                        } catch (rateError) {
                            console.warn(`[Exchange Rates] Failed to fetch EUR rate for USD`);
                        }
                    } else if (quoteCurrency === 'EUR') {
                        exchangeRateToEUR = 1.0;
                        // Fetch USD rate for EUR
                        try {
                            const rates = await getExchangeRates('EUR');
                            exchangeRateToUSD = rates.toUSD;
                        } catch (rateError) {
                            console.warn(`[Exchange Rates] Failed to fetch USD rate for EUR`);
                        }
                    }

                    await prisma.asset.upsert({
                        where: { symbol },
                        create: {
                            symbol,
                            currentPrice: price,
                            quoteCurrency,
                            exchangeRateToUSD,
                            exchangeRateToEUR,
                            name: quote.longName || quote.shortName || symbol
                        },
                        update: {
                            currentPrice: price,
                            quoteCurrency,
                            exchangeRateToUSD,
                            exchangeRateToEUR,
                            name: quote.longName || quote.shortName || symbol
                        }
                    });
                    return { symbol, status: 'updated', price, currency: quoteCurrency };
                } else {
                    console.warn(`[Price Update] No valid quote for ${symbol}`, quote);
                    return { symbol, status: 'no_data', quote };
                }
            } catch (err: any) {
                console.error(`Failed to fetch price for ${symbol}:`, err);
                return { symbol, status: 'error', error: err.message || err };
            }
        }));

        const updatedCount = results.filter(r => r.status === 'updated').length;

        revalidatePath(`/portfolio/${portfolioId}`);
        return { success: true, updatedCount, results };

    } catch (error) {
        console.error("Update prices error:", error);
        return { success: false, error: "Failed to update prices" };
    }
}

export async function searchAssets(query: string) {
    try {
        if (!query || query.length < 2) return { success: true, results: [] };

        const results = await yahooFinance.search(query);
        return {
            success: true,
            results: results.quotes
                .filter((q: any) => q.isYahooFinance) // Filter valid results
                .map((q: any) => ({
                    symbol: q.symbol,
                    name: q.shortname || q.longname || q.symbol,
                    type: q.quoteType,
                    exchange: q.exchange
                }))
        };
    } catch (error) {
        console.error("Search assets error:", error);
        return { success: false, error: "Failed to search assets" };
    }
}

/**
 * Get historical prices for a symbol
 * @param symbol Asset symbol
 * @param startDate Start date for historical data
 * @param endDate End date for historical data
 * @returns Map of date string to price
 */
export async function getHistoricalPrices(
    symbol: string,
    startDate: Date,
    endDate: Date
): Promise<Map<string, number>> {
    try {
        const result = await yahooFinance.historical(symbol, {
            period1: startDate,
            period2: endDate,
            interval: '1d'
        });

        const priceMap = new Map<string, number>();

        result.forEach((quote: any) => {
            if (quote.date && quote.close) {
                const dateStr = quote.date.toISOString().split('T')[0];
                priceMap.set(dateStr, quote.close);
            }
        });

        return priceMap;
    } catch (error) {
        console.error(`Failed to fetch historical prices for ${symbol}:`, error);
        return new Map();
    }
}
