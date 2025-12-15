
import { auth } from "@/auth"
import { getInvitations } from "@/actions/admin-actions"
import { InvitationManager } from "@/components/admin/invitation-manager"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
    const session = await auth()

    // TODO: Uncomment for real security
    // if (!session || session.user.role !== "ADMIN") {
    //   redirect("/login")
    // }

    const invitations = await getInvitations()

    return (
        <div className="container mx-auto py-10 px-4">
            <h1 className="text-3xl font-bold text-white mb-8">Admin Dashboard</h1>
            <InvitationManager initialInvitations={invitations} />
        </div>
    )
}
