
import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { db } from "@/lib/db"

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            credentials: {
                email: {},
                password: {},
            },
            authorize: async (credentials) => {
                const email = credentials.email as string
                const password = credentials.password as string

                if (!email || !password) return null

                const user = await db.user.findUnique({
                    where: { email },
                })

                if (!user) return null

                const passwordsMatch = await compare(password, user.passwordHash)

                if (!passwordsMatch) return null

                return {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                }
            },
        }),
    ],
    callbacks: {
        ...authConfig.callbacks,
        async session({ session, token }) {
            if (token && token.sub) {
                const user = await db.user.findUnique({
                    where: { id: token.sub }
                })

                if (!user) {
                    // User deleted from DB but token exists.
                    // Return null/undefined to signal invalid session? 
                    // Types might complain. 
                    // Usually returning a session with null user is how it's done?
                    // Or simply return default behavior but we know it's invalid?
                    // If I return `session`, the `id` will be populated from token.
                    // I must explicitly check user and return null if missing.
                    // Note: session callback return type expects Session | DefaultSession.
                    // If I return `session` as is, but modify it...
                    return {
                        expires: session.expires,
                        user: undefined
                    } as any
                }

                session.user.role = user.role
                session.user.id = user.id
            }
            return session
        }
    }
})
