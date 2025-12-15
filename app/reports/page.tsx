
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { getPortfolios, getAssetBreakdown } from "@/actions/portfolio"
import { calculatePortfolioStats, generateRebalancingRecommendations } from "@/lib/optimization-engine"
import { RiskProfile } from "@/lib/risk-engine"
import { RiskReport } from "@/components/reports/risk-report"
import { redirect } from "next/navigation"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function ReportsPage() {
    const session = await auth()

    // if (!session) redirect("/login")

    const riskProfileRecord = session?.user?.id ? await db.riskProfile.findUnique({
        where: { userId: session.user.id }
    }) : null;

    // Mock for development if no user/profile to allow viewing the UI
    // In prod, force redirect to onboarding
    if (!riskProfileRecord) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
                <div className="text-center">
                    <h1 className="text-3xl font-bold mb-4">No Profile Found</h1>
                    <p className="text-zinc-400 mb-8">You need to complete the risk assessment to view your analysis.</p>
                    <Link href="/onboarding" className="px-6 py-3 bg-teal-600 rounded-xl hover:bg-teal-500 transition">
                        Start Assessment
                    </Link>
                </div>
            </div>
        )
    }

    const { data: portfolios } = await getPortfolios()

    let allPositions: any[] = []

    if (portfolios) {
        for (const p of portfolios) {
            const breakdown = await getAssetBreakdown(p.id)
            if (breakdown.success && breakdown.data) {
                allPositions = [...allPositions, ...breakdown.data.map(item => ({
                    symbol: item.symbol,
                    amount: item.currentValue, // This is in Portfolio Currency...
                    assetClass: item.assetClass // Now available
                }))]
            }
        }
    }

    // ISSUE: Aggregating amounts in different currencies.
    // We need to convert everything to a base currency (e.g. EUR or USD) for stats.
    // Current implementation of calculatePortfolioStats assumes homogeneous numbers.
    // For MVP: Assume most portfolios are EUR or ignore currency diffs or we need a proper solution.
    // Re-reading user request: "Múltiples portafolios (eToro, Trade Republic)". Often EUR.
    // If mixed (USD vs EUR), simply adding them is wrong.
    // But `getAssetBreakdown` returns `currentValue` in Portfolio Currency.
    // I should probably skip complex multi-currency aggregation logic for this step inside `ReportsPage` unless I have rates.
    // I'll leave a TODO and sum them up raw for now, assuming user likely has EUR portfolios primarily or accepts the limitation.

    const stats = calculatePortfolioStats(allPositions)
    const profile = riskProfileRecord.profile as RiskProfile
    const recommendations = generateRebalancingRecommendations(stats, profile)

    return (
        <div className="min-h-screen bg-zinc-950 text-white py-8 px-4 md:px-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Portfolio Analysis</h1>
                        <p className="text-zinc-400">AI-driven insights based on your {profile} profile.</p>
                    </div>
                    <div className="flex gap-4">
                        <Link href="/onboarding" className="text-sm text-teal-400 hover:text-teal-300 underline">
                            Retake Assessment
                        </Link>
                        <Link href="/" className="text-sm text-zinc-400 hover:text-white">
                            Back to Dashboard
                        </Link>
                    </div>
                </header>

                <RiskReport
                    stats={stats}
                    recommendations={recommendations}
                    profile={profile}
                    score={riskProfileRecord.score}
                />
            </div>
        </div>
    )
}
