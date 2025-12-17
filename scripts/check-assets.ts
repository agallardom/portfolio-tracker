import { prisma } from "../lib/db";

async function main() {
    const assets = await prisma.asset.findMany();
    console.log("Assets in DB:", assets.map(a => `${a.symbol} (${a.name})`));
}

main().catch(console.error);
