"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { calculateRiskScore, determineRiskProfile } from "@/lib/risk-engine"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function saveRiskProfile(answers: Record<string, number>) {
    const session = await auth()
    if (!session || !session.user.id) {
        return { success: false, message: "Unauthorized" }
    }

    const score = calculateRiskScore(answers)
    const profile = determineRiskProfile(score)

    try {
        await db.riskProfile.upsert({
            where: { userId: session.user.id },
            create: {
                userId: session.user.id,
                score,
                profile,
                answers: JSON.stringify(answers),
            },
            update: {
                score,
                profile,
                answers: JSON.stringify(answers),
            }
        })
    } catch (error) {
        console.error("Failed to save profile:", error)
        return { success: false, message: "Failed to save profile" }
    }

    revalidatePath("/")
    return { success: true }
}
