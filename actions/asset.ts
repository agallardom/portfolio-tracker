"use server";

import { prisma } from "@/lib/db";
import YahooFinance from "yahoo-finance2";
import { revalidatePath } from "next/cache";

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
                    console.log(`[Price Update] Updated ${symbol}: ${quote.regularMarketPrice} (${quote.currency})`);
                    await prisma.asset.upsert({
                        where: { symbol },
                        create: {
                            symbol,
                            currentPrice: quote.regularMarketPrice,
                            name: quote.longName || quote.shortName || symbol
                        },
                        update: {
                            currentPrice: quote.regularMarketPrice,
                            name: quote.longName || quote.shortName || symbol
                        }
                    });
                    return { symbol, status: 'updated', price: quote.regularMarketPrice };
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
