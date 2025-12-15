"use server"

import { db } from "@/lib/db"
import { hash } from "bcryptjs"

export async function registerUser(token: string, password: string) {
    // 1. Verify token
    const invitation = await db.invitationToken.findUnique({
        where: { token },
    })

    if (!invitation) {
        return { success: false, message: "Invalid token" }
    }

    if (invitation.status !== "ACTIVE") {
        return { success: false, message: "Token is not active" }
    }

    if (new Date() > invitation.expiresAt) {
        return { success: false, message: "Token expired" }
    }

    // 2. Hash password
    const passwordHash = await hash(password, 12)

    // 3. Create user
    try {
        const user = await db.user.create({
            data: {
                email: invitation.email,
                passwordHash,
                role: "USER"
            }
        })

        // 4. Mark token used
        await db.invitationToken.update({
            where: { id: invitation.id },
            data: { status: "USED" }
        })

        return { success: true }
    } catch (error) {
        console.error(error)
        return { success: false, message: "Failed to create user. Email might be taken." }
    }
}
