"use server";

import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

// Cache for exchange rates to avoid excessive API calls
const rateCache = new Map<string, { rate: number; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Get exchange rate from one currency to another
 * @param from Source currency (e.g., "EUR")
 * @param to Target currency (e.g., "USD")
 * @returns Exchange rate or 1.0 if same currency or on error
 */
export async function getExchangeRate(from: string, to: string): Promise<number> {
    // Same currency, no conversion needed
    if (from === to) return 1.0;

    const cacheKey = `${from}${to}`;
    const cached = rateCache.get(cacheKey);

    // Return cached rate if still valid
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.rate;
    }

    try {
        // Yahoo Finance FX symbol format: EURUSD=X
        const symbol = `${from}${to}=X`;
        const quote = await yahooFinance.quote(symbol);

        if (quote && quote.regularMarketPrice) {
            const rate = quote.regularMarketPrice;
            rateCache.set(cacheKey, { rate, timestamp: Date.now() });
            console.log(`[Exchange Rate] ${from}/${to}: ${rate}`);
            return rate;
        }

        console.warn(`[Exchange Rate] No valid quote for ${symbol}`);
        return 1.0;
    } catch (error) {
        console.error(`[Exchange Rate] Failed to fetch ${from}/${to}:`, error);

        // Try inverse rate as fallback
        if (from !== to) {
            try {
                const inverseRate = await getInverseRate(to, from);
                if (inverseRate !== 1.0) {
                    const rate = 1 / inverseRate;
                    rateCache.set(cacheKey, { rate, timestamp: Date.now() });
                    return rate;
                }
            } catch (inverseError) {
                console.error(`[Exchange Rate] Inverse rate also failed:`, inverseError);
            }
        }

        return 1.0;
    }
}

/**
 * Helper to get inverse exchange rate
 */
async function getInverseRate(from: string, to: string): Promise<number> {
    const symbol = `${from}${to}=X`;
    const quote = await yahooFinance.quote(symbol);

    if (quote && quote.regularMarketPrice) {
        return quote.regularMarketPrice;
    }

    return 1.0;
}

/**
 * Get exchange rates for a currency to both USD and EUR
 * @param currency Source currency
 * @returns Object with rates to USD and EUR
 */
export async function getExchangeRates(currency: string): Promise<{
    toUSD: number;
    toEUR: number;
}> {
    const [toUSD, toEUR] = await Promise.all([
        getExchangeRate(currency, "USD"),
        getExchangeRate(currency, "EUR")
    ]);

    return { toUSD, toEUR };
}

/**
 * Convert amount from one currency to another
 * @param amount Amount to convert
 * @param from Source currency
 * @param to Target currency
 * @returns Converted amount
 */
export async function convertCurrency(
    amount: number,
    from: string,
    to: string
): Promise<number> {
    const rate = await getExchangeRate(from, to);
    return amount * rate;
}
