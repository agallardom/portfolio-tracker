"use client";

import { useState, useMemo } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Cell, ReferenceLine } from "recharts";

type PerformanceData = {
    period: string;
    gain: number;
    roi: number;
    invested: number;
    value: number;
    fullPeriod?: string;
};

type PerformanceChartProps = {
    data: {
        yearly: PerformanceData[];
        monthly: Record<string, PerformanceData[]>;
    };
    currency: string;
};

export function PerformanceChart({ data, currency }: PerformanceChartProps) {
    const [view, setView] = useState<'yearly' | 'monthly'>('monthly');
    const [selectedYear, setSelectedYear] = useState<string>(
        data.yearly.length > 0 ? data.yearly[data.yearly.length - 1].period : new Date().getFullYear().toString()
    );

    const chartData = useMemo(() => {
        if (view === 'yearly') {
            return data.yearly;
        } else {
            return data.monthly[selectedYear] || [];
        }
    }, [view, selectedYear, data]);

    const availableYears = data.yearly.map(y => y.period).sort((a, b) => b.localeCompare(a));

    if (!chartData || chartData.length === 0) {
        return (
            <div className="glass-card p-6 rounded-2xl h-80 flex items-center justify-center border-dashed">
                <p className="text-muted-foreground">No performance data available</p>
            </div>
        );
    }

    return (
        <div className="glass-card p-6 rounded-2xl h-96 w-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Performance Analysis</h3>

                <div className="flex gap-2">
                    {/* View Toggle */}
                    <div className="flex bg-secondary/30 p-1 rounded-lg h-9 items-center">
                        <button
                            onClick={() => setView('yearly')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all h-full ${view === 'yearly'
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                }`}
                        >
                            Yearly
                        </button>
                        <button
                            onClick={() => setView('monthly')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all h-full ${view === 'monthly'
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                }`}
                        >
                            Monthly
                        </button>
                    </div>

                    {/* Year Selector (Only for monthly view) */}
                    {view === 'monthly' && (
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="bg-secondary/30 border-transparent text-xs rounded-lg px-2 h-9 outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                        >
                            {availableYears.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                            dataKey="period"
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value}`}
                        />
                        <Tooltip
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload as PerformanceData;
                                    return (
                                        <div className="bg-card/95 backdrop-blur-sm border border-white/10 p-3 rounded-xl shadow-xl text-xs space-y-1">
                                            <p className="font-bold text-base mb-2">{label} {view === 'monthly' ? selectedYear : ''}</p>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                <span className="text-muted-foreground">Gain/Loss:</span>
                                                <span className={`font-mono text-right font-bold ${data.gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {data.gain >= 0 ? '+' : ''}{data.gain.toFixed(2)} {currency}
                                                </span>

                                                <span className="text-muted-foreground">ROI:</span>
                                                <span className={`font-mono text-right ${data.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {data.roi.toFixed(2)}%
                                                </span>

                                                <span className="text-muted-foreground mt-2 border-t border-white/10 pt-1">Invested:</span>
                                                <span className="font-mono text-right mt-2 border-t border-white/10 pt-1">{data.invested.toFixed(0)} {currency}</span>

                                                <span className="text-muted-foreground">End Value:</span>
                                                <span className="font-mono text-right">{data.value.toFixed(0)} {currency}</span>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <ReferenceLine y={0} stroke="#666" strokeWidth={1} />
                        <Bar dataKey="gain" radius={[4, 4, 0, 0]} maxBarSize={60}>
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.gain >= 0 ? '#4ade80' : '#f87171'}
                                    fillOpacity={0.8}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
