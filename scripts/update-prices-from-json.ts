// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function parseSymbol(assetName: string): string | null {
    // pattern 1: "SYMBOL - Name"
    const dashMatch = assetName.match(/^([A-Z0-9\.]+)\s-/);
    if (dashMatch) return dashMatch[1].trim();

    // pattern 2: "Name (SYMBOL)"
    const parenMatch = assetName.match(/\(([A-Z0-9\.]+)\)$/);
    if (parenMatch) return parenMatch[1].trim();

    // pattern 3: Just "SYMBOL" (fallback, usually simple names like "BTC")
    // If it looks like a symbol (no spaces, short-ish)
    if (!assetName.includes(' ') && assetName.length < 10) {
        return assetName;
    }

    return null;
}

async function main() {
    const jsonPath = path.join(process.cwd(), 'import', 'eToro_ajustes_2023.json');
    if (!fs.existsSync(jsonPath)) {
        console.error(`File not found: ${jsonPath}`);
        return;
    }
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(rawData);

    if (!data.portfolio_summary) {
        console.error('Invalid JSON format: missing portfolio_summary');
        return;
    }

    console.log(`Processing ${data.portfolio_summary.length} assets...`);

    for (const item of data.portfolio_summary) {
        const symbol = parseSymbol(item.asset_name);
        if (!symbol) {
            console.warn(`Could not parse symbol from: ${item.asset_name}`);
            continue;
        }

        const price = item.current_price;
        const netValue = item.net_value;
        const units = item.total_investment_units;

        // Skip invalid units (e.g. "<0.01" string from file, need to handle?)
        // JSON has "total_investment_units": 75.948849 (number) OR "<0.01" (string)
        let numericUnits = 0;
        if (typeof units === 'number') {
            numericUnits = units;
        } else if (typeof units === 'string') {
            if (units.includes('<')) {
                // handle small amounts, maybe 0?
                // If units is negligible, we can't accurately calc exchange rate.
                // We should probably skip rate calculation but update price?
                console.log(`Skipping rate calc for ${symbol} due to imprecise units: ${units}`);
                numericUnits = 0;
            } else {
                numericUnits = parseFloat(units);
            }
        }

        let exchangeRateToUSD = 1.0;
        // Default 1, but we should only update if we have data.
        // If units > 0, calc implied rate.
        let rateCalculated = false;

        if (numericUnits > 0 && price > 0) {
            // Market Value (Likely USD) = Units * Price (Asset) * Rate
            // Rate = Value / (Units * Price)
            const impliedRate = netValue / (numericUnits * price);
            // Sanity check?
            if (impliedRate > 0 && isFinite(impliedRate)) {
                exchangeRateToUSD = impliedRate;
                rateCalculated = true;
            }
        }

        // Find asset
        const asset = await prisma.asset.findFirst({
            where: {
                OR: [
                    { symbol: symbol },
                    { symbol: { contains: symbol } } // Fallback loose match?
                    // Better to be strict first.
                ]
            }
        });

        // Strict match first
        let targetAsset = await prisma.asset.findUnique({ where: { symbol } });

        if (!targetAsset) {
            console.log(`Asset not found: ${symbol} (Raw: ${item.asset_name})`);
            continue;
        }

        // Update
        const updateData: any = {
            currentPrice: price,
            updatedAt: new Date(), // Now
        };

        if (rateCalculated) {
            updateData.exchangeRateToUSD = exchangeRateToUSD;
            // Also estimate EUR rate? 
            // We usually fetch that live, but assume USD is anchor.
        }

        await prisma.asset.update({
            where: { symbol: targetAsset.symbol },
            data: updateData
        });

        console.log(`Updated ${symbol}: Price ${price}` + (rateCalculated ? `, Rate ${exchangeRateToUSD.toFixed(4)}` : ''));
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
