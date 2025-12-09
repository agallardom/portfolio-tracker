"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

type ChartData = {
    date: string;
    invested: number;
    value: number;
}[];

export function PortfolioChart({ data }: { data: ChartData }) {
    if (!data || data.length === 0) {
        return (
            <div className="glass-card p-6 rounded-2xl h-80 flex items-center justify-center border-dashed">
                <p className="text-muted-foreground">No data available for chart</p>
            </div>
        );
    }

    return (
        <div className="glass-card p-6 rounded-2xl h-80 w-full">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Performance</h3>
            <div className="w-full h-full pb-6">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={30}
                        />
                        <YAxis
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value}`}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}
                            itemStyle={{ color: '#fff' }}
                            labelStyle={{ color: '#888' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={false}
                            name="Current Value"
                        />
                        <Line
                            type="monotone"
                            dataKey="invested"
                            stroke="#888888"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={false}
                            name="Invested"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
