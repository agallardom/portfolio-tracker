"use client"

import { useState } from "react"
import { generateInvitation, revokeInvitation } from "@/actions/admin-actions"
import { Check, Copy, Loader2, Plus, Trash2, X } from "lucide-react"

type Invitation = {
    id: string
    email: string
    token: string
    status: string
    expiresAt: Date
    createdAt: Date
}

export function InvitationManager({ initialInvitations }: { initialInvitations: Invitation[] }) {
    const [email, setEmail] = useState("")
    const [loading, setLoading] = useState(false)
    const [generatedLink, setGeneratedLink] = useState("")
    const [error, setError] = useState("")

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")
        setGeneratedLink("")

        try {
            const res = await generateInvitation(email)
            if (res.success && res.link) {
                setGeneratedLink(res.link)
                setEmail("")
            } else {
                setError(res.message || "Failed")
            }
        } catch (err) {
            setError("Error generating invitation")
        } finally {
            setLoading(false)
        }
    }

    const handleRevoke = async (id: string) => {
        if (!confirm("Are you sure you want to revoke this invitation?")) return
        await revokeInvitation(id)
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        alert("Copied to clipboard!")
    }

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-zinc-800">
                <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
                    Invitation Manager
                </h2>
                <p className="text-sm text-zinc-400 mt-1">Generate and manage access tokens.</p>
            </div>

            <div className="p-6 bg-zinc-900/50">
                <form onSubmit={handleGenerate} className="flex gap-4">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Invitee Email"
                        required
                        className="flex-1 px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-zinc-200"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Generate
                    </button>
                </form>

                {error && <p className="mt-2 text-red-400 text-sm">{error}</p>}

                {generatedLink && (
                    <div className="mt-4 p-4 bg-teal-500/10 border border-teal-500/20 rounded-lg flex items-center justify-between">
                        <code className="text-teal-300 text-sm truncate mr-4">{generatedLink}</code>
                        <button
                            onClick={() => copyToClipboard(generatedLink)}
                            className="p-2 hover:bg-teal-500/20 rounded-md text-teal-400 transition-colors"
                        >
                            <Copy className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            <div className="border-t border-zinc-800">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-zinc-500 uppercase bg-zinc-950/50 border-b border-zinc-800">
                        <tr>
                            <th className="px-6 py-3">Email</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Expires</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                        {initialInvitations.map((inv) => (
                            <tr key={inv.id} className="hover:bg-zinc-800/20 transition-colors">
                                <td className="px-6 py-4 font-medium text-zinc-200">{inv.email}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${inv.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' :
                                            inv.status === 'USED' ? 'bg-blue-500/10 text-blue-400' :
                                                'bg-red-500/10 text-red-400'
                                        }`}>
                                        {inv.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-zinc-400">
                                    {new Date(inv.expiresAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {inv.status === 'ACTIVE' && (
                                        <button
                                            onClick={() => handleRevoke(inv.id)}
                                            className="text-zinc-500 hover:text-red-400 transition-colors"
                                            title="Revoke"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {initialInvitations.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                                    No invitations found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
