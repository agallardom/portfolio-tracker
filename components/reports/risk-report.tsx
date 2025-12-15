"use client"

import { PortfolioStats, RebalancingRecommendation } from "@/lib/optimization-engine"
import { BENCHMARK_ALLOCATION, RiskProfile } from "@/lib/risk-engine"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { ArrowRight, TrendingUp, AlertTriangle, ShieldCheck, Target } from "lucide-react"

interface RiskReportProps {
    stats: PortfolioStats
    recommendations: RebalancingRecommendation[]
    profile: RiskProfile
    score: number
}

const COLORS = {
    Equity: "#14b8a6", // teal-500
    Fixed: "#3b82f6",  // blue-500
    Cash: "#8b5cf6",   // violet-500
    Other: "#71717a"   // zinc-500
}

export function RiskReport({ stats, recommendations, profile, score }: RiskReportProps) {

    const benchmark = BENCHMARK_ALLOCATION[profile]

    const actualData = [
        { name: "Renta Variable", value: stats.allocation.equity, color: COLORS.Equity },
        { name: "Renta Fija / Cash", value: stats.allocation.fixed, color: COLORS.Fixed },
        // Fixed now includes Cash in our logic, so standard "Renta Fija"
    ]

    const targetData = [
        { name: "Renta Variable", value: (benchmark.equity[0] + benchmark.equity[1]) / 2, color: COLORS.Equity },
        { name: "Renta Fija / Cash", value: (benchmark.fixed[0] + benchmark.fixed[1]) / 2, color: COLORS.Fixed },
    ]

    return (
        <div className="space-y-8">
            {/* Header: Profile */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Target className="w-32 h-32 text-teal-500" />
                    </div>
                    <div className="relative z-10">
                        <span className="text-zinc-400 uppercase tracking-wider text-xs font-semibold">Your Risk Profile</span>
                        <h2 className="text-4xl font-bold text-white mt-1 mb-2">{profile}</h2>
                        <div className="flex items-center gap-4 text-sm text-zinc-300">
                            <span className="bg-zinc-800 px-3 py-1 rounded-full border border-zinc-700">Score: {score}/55</span>
                            <span>Target: {benchmark.fixed[0]}-{benchmark.fixed[1]}% RF / {benchmark.equity[0]}-{benchmark.equity[1]}% RV</span>
                        </div>
                        <p className="mt-4 text-zinc-400 max-w-lg">
                            Based on your questionnaire, we have calibrated your optimal asset allocation.
                        </p>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-center">
                    <h3 className="text-zinc-400 text-sm font-medium mb-4">Risk Metrics (Est.)</h3>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-zinc-300">Volatility</span>
                                <span className="text-white font-mono">{stats.riskMetrics.volatility}%</span>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-yellow-500" style={{ width: `${stats.riskMetrics.volatility * 2}%` }} />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-zinc-300">Max Drawdown</span>
                                <span className="text-red-400 font-mono">{stats.riskMetrics.maxDrawdown}%</span>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500" style={{ width: `${Math.abs(stats.riskMetrics.maxDrawdown) * 2}%` }} />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-zinc-300">Sharpe Ratio</span>
                                <span className="text-green-400 font-mono">{stats.riskMetrics.sharpeRatio}</span>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500" style={{ width: `${stats.riskMetrics.sharpeRatio * 30}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Allocation Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-6">Current Allocation</h3>
                    <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={actualData}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {actualData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-6">Target Model ({profile})</h3>
                    <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={targetData}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {targetData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" opacity={0.7} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Recommendations */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-zinc-800">
                    <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-teal-400" />
                        AI Optimization Plan
                    </h3>
                </div>
                <div className="p-6">
                    {recommendations.length > 0 ? (
                        <div className="space-y-4">
                            {recommendations.map((rec, idx) => (
                                <div key={idx} className="flex flex-col md:flex-row items-start md:items-center justify-between bg-zinc-950/50 border border-zinc-800 p-4 rounded-xl">
                                    <div className="flex items-start gap-4 mb-4 md:mb-0">
                                        <div className={`
                                      p-3 rounded-lg
                                      ${rec.action === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}
                                  `}>
                                            {rec.action === 'BUY' ? <TrendingUp className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-zinc-200 text-lg">
                                                {rec.action} <span className={rec.action === 'BUY' ? 'text-green-400' : 'text-red-400'}>{rec.assetClass}</span>
                                            </h4>
                                            <p className="text-sm text-zinc-500 mt-1">{rec.reason}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-2xl font-bold text-white block">
                                            {rec.amount.toLocaleString(undefined, { style: 'currency', currency: 'EUR' })}
                                        </span>
                                        <span className="text-xs text-zinc-600 uppercase tracking-wider">Estimated Amount</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <ShieldCheck className="w-8 h-8 text-green-400" />
                            </div>
                            <h4 className="text-lg font-medium text-white">Perfectly Balanced</h4>
                            <p className="text-zinc-400 mt-2">Your portfolio aligns with your {profile} risk profile.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
