"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { v4 as uuidv4 } from "uuid"
import { revalidatePath } from "next/cache"

export async function generateInvitation(email: string) {
    const session = await auth()

    // TODO: Uncomment this when we have an admin user created
    // if (!session || session.user.role !== "ADMIN") {
    //   throw new Error("Unauthorized")
    // }

    // Generate new token details
    const token = uuidv4()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 48) // 48 hours expiry

    try {
        await db.invitationToken.upsert({
            where: { email },
            update: {
                token,
                expiresAt,
                status: "ACTIVE"
            },
            create: {
                token,
                email,
                expiresAt,
                status: "ACTIVE"
            }
        })

        revalidatePath("/admin")
        return { success: true, token, link: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/register?token=${token}` }
    } catch (error) {
        console.error("Error generating invitation:", error)
        return { success: false, message: "Failed to generate invitation", token: undefined, link: undefined }
    }
}

export async function revokeInvitation(id: string) {
    const session = await auth()
    // if (!session || session.user.role !== "ADMIN") {
    //   throw new Error("Unauthorized")
    // }

    await db.invitationToken.update({
        where: { id },
        data: {
            status: "REVOKED" // or EXPIRED
        }
    })

    revalidatePath("/admin")
    return { success: true }
}

export async function getInvitations() {
    const session = await auth()
    // if (!session || session.user.role !== "ADMIN") {
    //   throw new Error("Unauthorized")
    // }

    return await db.invitationToken.findMany({
        orderBy: { createdAt: "desc" }
    })
}
