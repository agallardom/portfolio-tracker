
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const txs = await prisma.transaction.findMany({
        where: {
            assetSymbol: {
                contains: 'ULVR'
            },
            type: 'BUY'
        }
    });

    console.log('Found transactions:', txs.length);
    txs.forEach(t => {
        console.log(`ID: ${t.id} | Type: ${t.type} | Date: ${t.date} | Amount: ${t.amount} | Fee: ${t.fee} | Details: ${JSON.stringify(t)}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
