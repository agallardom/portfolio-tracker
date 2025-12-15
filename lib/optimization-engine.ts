
import { BENCHMARK_ALLOCATION, RiskProfile } from "./risk-engine"

interface AssetPosition {
    symbol: string
    amount: number // Current Value
    assetClass: string
}

export interface PortfolioStats {
    totalValue: number
    allocation: {
        equity: number // percentage
        fixed: number  // percentage
        cash: number   // percentage
        other: number
    }
    riskMetrics: {
        volatility: number
        maxDrawdown: number
        sharpeRatio: number
    }
}

export interface RebalancingRecommendation {
    action: "BUY" | "SELL" | "HOLD"
    assetClass: string
    amount: number
    reason: string
}

export function calculatePortfolioStats(positions: AssetPosition[]): PortfolioStats {
    const totalValue = positions.reduce((sum, p) => sum + p.amount, 0)

    if (totalValue === 0) {
        return {
            totalValue: 0,
            allocation: { equity: 0, fixed: 0, cash: 0, other: 0 },
            riskMetrics: { volatility: 0, maxDrawdown: 0, sharpeRatio: 0 }
        }
    }

    const allocation = {
        equity: 0,
        fixed: 0,
        cash: 0,
        other: 0
    }

    for (const p of positions) {
        const cls = (p.assetClass || "EQUITY").toUpperCase()
        if (cls === "EQUITY" || cls === "STOCK" || cls === "ETF") allocation.equity += p.amount
        else if (cls === "FIXED_INCOME" || cls === "BOND") allocation.fixed += p.amount
        else if (cls === "CASH") allocation.cash += p.amount
        else allocation.other += p.amount
    }

    // Normalize to 100% (excluding other if we want, but better include)
    // User bench is Fixed vs Equities. Cash counts as Fixed usually or separate?
    // User req: "Renta Fija (Bonos, Deuda, Efectivo)" -> Cash is Fixed.

    allocation.fixed += allocation.cash // Merge Cash into Fixed as per requirements
    allocation.cash = 0

    return {
        totalValue,
        allocation: {
            equity: (allocation.equity / totalValue) * 100,
            fixed: (allocation.fixed / totalValue) * 100,
            cash: 0,
            other: (allocation.other / totalValue) * 100
        },
        riskMetrics: {
            // Mocked for now as we need historical daily data for real calc
            volatility: 12.5,
            maxDrawdown: -15.4,
            sharpeRatio: 1.2
        }
    }
}

export function generateRebalancingRecommendations(
    stats: PortfolioStats,
    profile: RiskProfile
): RebalancingRecommendation[] {
    const benchmark = BENCHMARK_ALLOCATION[profile]
    if (!benchmark) return []

    const recommendations: RebalancingRecommendation[] = []
    const { totalValue } = stats
    const { equity, fixed } = stats.allocation

    // Check Equity
    const [minEq, maxEq] = benchmark.equity
    const targetEq = (minEq + maxEq) / 2 // Aim for mid-point
    const currentEqVal = (equity / 100) * totalValue
    const targetEqVal = (targetEq / 100) * totalValue
    const diffEq = targetEqVal - currentEqVal

    // Check Fixed
    const [minFix, maxFix] = benchmark.fixed
    const targetFix = (minFix + maxFix) / 2
    const currentFixVal = (fixed / 100) * totalValue
    const targetFixVal = (targetFix / 100) * totalValue
    const diffFix = targetFixVal - currentFixVal

    // Threshold to recommend action (e.g. 5% deviation)
    const THRESHOLD_PERCENT = 5
    if (Math.abs(equity - targetEq) > THRESHOLD_PERCENT) {
        recommendations.push({
            action: diffEq > 0 ? "BUY" : "SELL",
            assetClass: "Renta Variable (Equity)",
            amount: Math.abs(diffEq),
            reason: `Current ${equity.toFixed(1)}% is ${diffEq > 0 ? 'below' : 'above'} target range (${minEq}-${maxEq}%)`
        })
    }

    if (Math.abs(fixed - targetFix) > THRESHOLD_PERCENT) {
        recommendations.push({
            action: diffFix > 0 ? "BUY" : "SELL",
            assetClass: "Renta Fija (Fixed/Cash)",
            amount: Math.abs(diffFix),
            reason: `Current ${fixed.toFixed(1)}% is ${diffFix > 0 ? 'below' : 'above'} target range (${minFix}-${maxFix}%)`
        })
    }

    return recommendations
}
