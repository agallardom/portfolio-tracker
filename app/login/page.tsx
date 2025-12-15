
import { LoginForm } from "@/components/auth/login-form"

export const metadata = {
    title: "Login - Portfolio Tracker",
}

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-teal-900/20 opacity-30 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 opacity-30 blur-[120px] rounded-full pointer-events-none" />

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500 mb-2">
                        Portfolio Tracker
                    </h1>
                    <p className="text-zinc-500">Secure Access Portal</p>
                </div>

                <div className="w-full p-8 bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl">
                    <LoginForm />
                </div>
            </div>
        </div>
    )
}
