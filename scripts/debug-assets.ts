
import { prisma } from "../lib/db";

async function main() {
    const assets = await prisma.asset.findMany({
        where: {
            symbol: {
                endsWith: '.L'
            }
        }
    });

    console.log("London Assets found:", assets.length);
    assets.forEach(a => {
        console.log(`${a.symbol}: QuoteCurrency='${a.quoteCurrency}', Name='${a.name}'`);
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
