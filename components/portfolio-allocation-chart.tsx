"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

type AssetAllocation = {
    symbol: string;
    name: string;
    currentValue: number;
    allocationPercent: number;
};

const COLORS = [
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#f59e0b', // amber
    '#10b981', // emerald
    '#06b6d4', // cyan
    '#f97316', // orange
    '#6366f1', // indigo
    '#14b8a6', // teal
    '#a855f7', // violet
];

export function PortfolioAllocationChart({
    data,
    currency
}: {
    data: AssetAllocation[];
    currency: string;
}) {
    if (!data || data.length === 0) {
        return (
            <div className="glass-card p-6 rounded-2xl h-80 flex items-center justify-center border-dashed">
                <p className="text-muted-foreground">No assets to display</p>
            </div>
        );
    }

    // Filter out assets with 0 value
    const chartData = data
        .filter(asset => asset.currentValue > 0)
        .map(asset => ({
            name: asset.symbol,
            value: asset.currentValue,
            percent: asset.allocationPercent
        }));

    if (chartData.length === 0) {
        return (
            <div className="glass-card p-6 rounded-2xl h-80 flex items-center justify-center border-dashed">
                <p className="text-muted-foreground">No assets with value to display</p>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-black/90 border border-white/10 rounded-lg p-3">
                    <p className="font-medium">{payload[0].name}</p>
                    <p className="text-sm text-muted-foreground">
                        {payload[0].value.toFixed(2)} {currency}
                    </p>
                    <p className="text-sm font-mono text-primary">
                        {payload[0].payload.percent.toFixed(1)}%
                    </p>
                </div>
            );
        }
        return null;
    };

    const CustomLegend = ({ payload }: any) => {
        return (
            <div className="flex flex-wrap gap-3 justify-center mt-4">
                {payload.map((entry: any, index: number) => (
                    <div key={`legend-${index}`} className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-xs text-muted-foreground">
                            {entry.value} ({entry.payload.percent.toFixed(1)}%)
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="glass-card p-6 rounded-2xl w-full">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Portfolio Allocation</h3>
            <div className="w-full" style={{ height: '450px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="35%"
                            outerRadius={85}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend content={<CustomLegend />} verticalAlign="bottom" height={100} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
