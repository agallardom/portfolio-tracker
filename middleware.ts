import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

export default NextAuth(authConfig).auth((req) => {
    const isLoggedIn = !!req.auth
    const isOnDashboard = req.nextUrl.pathname.startsWith("/") &&
        !req.nextUrl.pathname.startsWith("/login") &&
        !req.nextUrl.pathname.startsWith("/register")

    if (isOnDashboard) {
        if (!isLoggedIn) {
            return Response.redirect(new URL("/login", req.nextUrl))
        }
    }

    // Redirect authenticated users away from login/register? 
    // Maybe, but let's keep it simple. Only protect dashboard.
})

export const config = {
    // Matcher ignoring _next/static, _next/image, favicon.ico, etc.
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
