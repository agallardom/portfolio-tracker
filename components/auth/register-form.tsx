"use client"

import { useState } from "react"
import { registerUser } from "@/actions/auth-actions"
import { useRouter } from "next/navigation"

export function RegisterForm({ token, email }: { token: string, email?: string }) {
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        if (password.length < 8) {
            setError("Password must be at least 8 characters")
            setLoading(false)
            return
        }

        try {
            const res = await registerUser(token, password)
            if (res.success) {
                router.push("/login?registered=true")
            } else {
                setError(res.message || "Something went wrong")
            }
        } catch (err) {
            setError("An unexpected error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full max-w-md p-8 bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl">
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500 mb-2">
                Complete Registration
            </h2>
            <p className="text-zinc-400 mb-8">
                Set up your password to access your portfolio.
            </p>

            {email && (
                <div className="mb-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                    <span className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Email</span>
                    <span className="text-zinc-200 font-medium">{email}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                        Password
                    </label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none text-zinc-100 placeholder-zinc-600"
                        placeholder="••••••••"
                        required
                    />
                </div>

                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-500/20"
                >
                    {loading ? "Creating Account..." : "Create Account"}
                </button>
            </form>
        </div>
    )
}
