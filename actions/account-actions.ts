"use server"

import { auth, signOut } from "@/auth"
import { db } from "@/lib/db"

export async function deleteMyAccount() {
    const session = await auth()

    if (!session?.user?.id) {
        return { success: false, message: "Not authenticated" }
    }

    const userId = session.user.id

    try {
        // User could have portfolios, risk profile, etc.
        // We need to clean up.

        // 1. Delete Risk Profile
        await db.riskProfile.deleteMany({
            where: { userId }
        })

        // 2. Find Portfolios
        const portfolios = await db.portfolio.findMany({
            where: { userId }
        })

        // 3. Delete Transactions for each portfolio
        for (const p of portfolios) {
            await db.transaction.deleteMany({
                where: { portfolioId: p.id }
            })
        }

        // 4. Delete Portfolios
        await db.portfolio.deleteMany({
            where: { userId }
        })

        // 5. Delete User
        await db.user.delete({
            where: { id: userId }
        })

        // Return success, but we can't really return because we need to sign out.
        // But signOut should happen.
    } catch (error) {
        console.error("Error deleting account:", error)
        return { success: false, message: "Failed to delete account" }
    }

    await signOut({ redirectTo: "/login" })
}

export async function logOut() {
    await signOut({ redirectTo: "/login" })
}
