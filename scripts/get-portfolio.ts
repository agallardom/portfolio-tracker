
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const portfolio = await prisma.portfolio.findFirst();
    if (portfolio) {
        console.log(`Portfolio Found: ${portfolio.name} (ID: ${portfolio.id})`);
    } else {
        console.log("No portfolios found.");
        // Create one? Need user ID.
        const user = await prisma.user.findFirst();
        if (user) {
            const newP = await prisma.portfolio.create({
                data: {
                    name: "My Portfolio",
                    currency: "USD",
                    userId: user.id
                }
            });
            console.log(`Created Portfolio: ${newP.name} (ID: ${newP.id})`);
        } else {
            console.log("No user found to create portfolio for.");
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
