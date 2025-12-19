
import { prisma } from "../lib/db";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

async function main() {
    // 1. Get all assets and their transactions to calculate quantity
    const assets = await prisma.asset.findMany({
        include: {
            transactions: true
        }
    });

    let portfolioItems = [];
    let totalValue = 0;

    console.log("Fetching portfolio data...");

    for (const asset of assets) {
        // Calculate Quantity
        let quantity = 0;
        for (const tx of asset.transactions) {
            if (tx.type === 'BUY' || tx.type === 'SAVEBACK' || tx.type === 'ROUNDUP' || tx.type === 'GIFT') {
                quantity += tx.quantity || 0;
            } else if (tx.type === 'SELL') {
                quantity -= tx.quantity || 0;
            }
        }

        if (quantity < 0.0001) continue; // Skip empty positions

        // Get Price (Use stored currentPrice or fetch if 0/null?)
        // For accurate report, let's try to trust the stored price if updated recently, 
        // but since we just imported, maybe prices are 0.
        // Let's quick fetch from Yahoo if we can, else defaults.
        let price = asset.currentPrice || 0;

        if (price === 0 && asset.symbol) {
            try {
                const quote = await yahooFinance.quote(asset.symbol);
                price = quote.regularMarketPrice || 0;
            } catch (e) {
                // console.warn(`Failed to fetch price for ${asset.symbol}`);
            }
        }

        const value = quantity * price;
        totalValue += value;

        portfolioItems.push({
            symbol: asset.symbol,
            quantity: quantity,
            price: price,
            value: value
        });
    }

    // Sort by value desc
    portfolioItems.sort((a, b) => b.value - a.value);

    // Format output
    console.log("\n📊 ESTIMACIÓN DE CARTERA ACTUAL (Para el Prompt)");
    console.log(`Capital Total Estimado: ${totalValue.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`);
    console.log("------------------------------------------------");

    portfolioItems.forEach(item => {
        const weight = (totalValue > 0) ? (item.value / totalValue) * 100 : 0;
        console.log(`${weight.toFixed(2)}% ${item.symbol} (${item.quantity.toFixed(4)} shares @ ${item.price.toFixed(2)}€)`);
    });

    // Output JSON for constructing the user response
    // console.log(JSON.stringify(portfolioItems));
}

main();
