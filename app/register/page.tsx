
import { db } from "@/lib/db"
import { RegisterForm } from "@/components/auth/register-form"
import { redirect } from "next/navigation"

export const metadata = {
    title: "Complete Your Registration",
}

export default async function RegisterPage(props: {
    searchParams: Promise<{ token?: string }>
}) {
    const searchParams = await props.searchParams
    const token = searchParams.token

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black text-white">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-red-500 mb-2">Missing Token</h1>
                    <p className="text-zinc-400">Please use the link provided in your invitation email.</p>
                </div>
            </div>
        )
    }

    const invitation = await db.invitationToken.findUnique({
        where: { token },
    })

    if (!invitation || invitation.status !== "ACTIVE" || invitation.expiresAt < new Date()) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black text-white">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-red-500 mb-2">Invalid or Expired Link</h1>
                    <p className="text-zinc-400">This invitation link is invalid or has expired.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white p-4">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-900/20 via-zinc-950 to-zinc-950 pointer-events-none" />
            <div className="relative z-10 w-full flex justify-center">
                <RegisterForm token={token} email={invitation.email} />
            </div>
        </div>
    )
}
