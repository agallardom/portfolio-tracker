
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const portfolioId = 'd26e2ad7-0eee-4b3b-a269-fbee94c020d9';
    console.log(`Checking summary for ${portfolioId}...`);

    const portfolio = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
    if (!portfolio) { console.log('Portfolio not found'); return; }

    const transactions = await prisma.transaction.findMany({
        where: { portfolioId },
        include: { asset: true },
        orderBy: { date: 'asc' }
    });

    let totalInvested = 0; // Tracks implicit + explicit
    let explicitInvested = 0; // Tracks ONLY explicit
    let cashBalance = 0;
    const holdings = new Map();
    const prices = new Map();
    let realizedGains = 0;
    let totalDividends = 0;
    let totalFees = 0;

    for (const tx of transactions) {
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
                break;
            case "WITHDRAWAL":
                cashBalance -= tx.amount;
                totalInvested -= tx.amount;
                explicitInvested -= tx.amount;
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
                        const gain = proceed - costOfSold;
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
                break;
        }
    }

    // Net Invested calculation
    const netInvested = explicitInvested + realizedGains + totalDividends - totalFees;

    console.log(`Implicit Invested: ${totalInvested}`);
    console.log(`Explicit Invested: ${explicitInvested}`);
    console.log(`Realized: ${realizedGains}`);
    console.log(`Divs: ${totalDividends}`);
    console.log(`Fees: ${totalFees}`);
    console.log(`Net Invested (User Formula): ${netInvested}`);
    console.log(`Cash Balance: ${cashBalance}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
