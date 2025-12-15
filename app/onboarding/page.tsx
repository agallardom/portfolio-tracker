
import { auth } from "@/auth"
import { Questionnaire } from "@/components/onboarding/questionnaire"
import { redirect } from "next/navigation"

export const metadata = {
    title: "Build Your Investor Profile",
}

export default async function OnboardingPage() {
    const session = await auth()

    if (!session) {
        redirect("/login")
    }

    return (
        <div className="min-h-screen bg-black text-white py-12 px-4 relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-teal-900/20 opacity-30 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 container mx-auto flex flex-col items-center">
                <div className="text-center mb-12 max-w-2xl">
                    <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-400 mb-4">
                        Let's personalize your strategy.
                    </h1>
                    <p className="text-zinc-400 text-lg">
                        Answer a few questions to help us determine your optimal risk profile and asset allocation.
                    </p>
                </div>

                <Questionnaire />
            </div>
        </div>
    )
}
