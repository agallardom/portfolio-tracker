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

export async function applyAdjustments(portfolioId: string, jsonContent: string) {
    try {
        const data = JSON.parse(jsonContent);

        if (!data.portfolio_summary || !Array.isArray(data.portfolio_summary)) {
            return { success: false, error: "Invalid JSON format: missing 'portfolio_summary' array." };
        }

        let updatedCount = 0;
        let errors: string[] = [];

        for (const item of data.portfolio_summary) {
            const symbol = parseSymbol(item.asset_name);
            if (!symbol) {
                // errors.push(`Could not parse symbol from: ${item.asset_name}`);
                continue;
            }

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

            // Find asset
            const targetAsset = await prisma.asset.findUnique({ where: { symbol } });

            if (!targetAsset) {
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
            updatedCount++;
        }

        revalidatePath(`/portfolio/${portfolioId}`);
        return { success: true, message: `Successfully updated ${updatedCount} assets.` };

    } catch (error) {
        console.error("Failed to apply adjustments:", error);
        return { success: false, error: "Failed to process adjustments file." };
    }
}
