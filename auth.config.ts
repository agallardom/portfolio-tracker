import type { NextAuthConfig } from "next-auth"

export const authConfig = {
    pages: {
        signIn: "/login",
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = (user as any).role
                token.id = user.id
            }
            return token
        },
        async session({ session, token }) {
            if (token) {
                if (session.user) {
                    session.user.role = token.role as string
                    session.user.id = token.id as string
                }
            }
            return session
        },
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user
            const isOnDashboard = nextUrl.pathname.startsWith("/") &&
                !nextUrl.pathname.startsWith("/login") &&
                !nextUrl.pathname.startsWith("/register") &&
                !nextUrl.pathname.startsWith("/api")

            if (isOnDashboard) {
                if (isLoggedIn) return true
                return false // Redirect to login
            }
            return true
        },
    },
    providers: [], // Configured in auth.ts
} satisfies NextAuthConfig
