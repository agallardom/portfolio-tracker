"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { calculateRiskScore, determineRiskProfile } from "@/lib/risk-engine"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function saveRiskProfile(
    answers: Record<string, number>,
    context?: {
        horizon: string,
        goal: string,
        restrictions: string
    }
) {
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
                // New Fields
                investmentHorizon: context?.horizon || null,
                investmentGoal: context?.goal || null,
                restrictions: context?.restrictions || null,
            },
            update: {
                score,
                profile,
                answers: JSON.stringify(answers),
                // New Fields
                investmentHorizon: context?.horizon || null,
                investmentGoal: context?.goal || null,
                restrictions: context?.restrictions || null,
            }
        })
    } catch (error) {
        console.error("Failed to save profile:", error)
        return { success: false, message: "Failed to save profile" }
    }

    revalidatePath("/")
    return { success: true }
}
