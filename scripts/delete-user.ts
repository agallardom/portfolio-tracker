
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    const email = process.argv[2]
    if (!email) {
        console.error("Please provide an email address")
        process.exit(1)
    }

    console.log(`Deleting user with email: ${email}...`)

    try {
        // Delete related data first if not cascading?
        // Prisma schema usually doesn't cascade unless specified in relation.
        // Schema:
        // User -> Portfolios
        // User -> RiskProfile
        // Portfolio -> Transactions
        // Let's rely on manual deletion to be safe or check schema behavior.
        // Actually, let's look up the user first.
        const user = await prisma.user.findUnique({
            where: { email },
            include: { portfolios: true, riskProfile: true }
        })

        if (!user) {
            console.log("User not found.")
            return
        }

        // Delete Risk Profile
        if (user.riskProfile) {
            await prisma.riskProfile.delete({ where: { id: user.riskProfile.id } })
        }

        // Delete Portfolios and their transactions
        for (const p of user.portfolios) {
            await prisma.transaction.deleteMany({ where: { portfolioId: p.id } })
            await prisma.portfolio.delete({ where: { id: p.id } })
        }

        // Delete User
        await prisma.user.delete({ where: { id: user.id } })

        console.log("✅ User and all related data deleted successfully.")

    } catch (error) {
        console.error("Error deleting user:", error)
    } finally {
        await prisma.$disconnect()
    }
}

main()
