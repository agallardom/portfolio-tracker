"use client"

import { useActionState, useState } from "react"
import { authenticate } from "@/actions/login"
import { Loader2, Eye, EyeOff } from "lucide-react"

export function LoginForm() {
    const [errorMessage, formAction, isPending] = useActionState(
        authenticate,
        undefined,
    )
    const [showPassword, setShowPassword] = useState(false)

    return (
        <form action={formAction} className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Email
                </label>
                <input
                    name="email"
                    type="email"
                    required
                    className="w-full px-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none text-zinc-100 placeholder-zinc-600"
                    placeholder="admin@example.com"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Password
                </label>
                <div className="relative">
                    <input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        required
                        className="w-full px-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none text-zinc-100 placeholder-zinc-600 pr-12"
                        placeholder="••••••••"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300 transition-colors p-1"
                    >
                        {showPassword ? (
                            <EyeOff className="w-5 h-5" />
                        ) : (
                            <Eye className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </div>

            {errorMessage && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    {errorMessage}
                </div>
            )}

            <button
                type="submit"
                disabled={isPending}
                className="w-full py-4 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2"
            >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign In
            </button>
        </form>
    )
}
