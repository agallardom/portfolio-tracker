"use client";

import { useState, useMemo } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";

type ChartData = {
    date: string;
    invested: number;
    value: number;
}[];

type TimePeriod = '1D' | '1W' | '1M' | 'YTD' | 'MAX';

export function PortfolioChart({ data }: { data: ChartData }) {
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('MAX');

    const filteredData = useMemo(() => {
        if (!data || data.length === 0) return [];

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        let cutoffDate: Date;
        let sampleInterval = 1; // Days between samples

        switch (selectedPeriod) {
            case '1D':
                cutoffDate = new Date(today);
                cutoffDate.setDate(cutoffDate.getDate() - 1);
                sampleInterval = 1; // Every day
                break;
            case '1W':
                cutoffDate = new Date(today);
                cutoffDate.setDate(cutoffDate.getDate() - 7);
                sampleInterval = 1; // Every day
                break;
            case '1M':
                cutoffDate = new Date(today);
                cutoffDate.setMonth(cutoffDate.getMonth() - 1);
                sampleInterval = 1; // Every day
                break;
            case 'YTD':
                cutoffDate = new Date(now.getFullYear(), 0, 1); // January 1st of current year
                sampleInterval = 7; // Every week
                break;
            case 'MAX':
            default:
                // Show all data but sample every 7 days for performance
                const filtered = data.filter((_, index) => index % 7 === 0 || index === data.length - 1);
                return filtered;
        }

        // Filter by date range
        const rangeFiltered = data.filter(point => {
            const pointDate = new Date(point.date);
            return pointDate >= cutoffDate;
        });

        // Sample based on interval
        if (sampleInterval > 1) {
            return rangeFiltered.filter((_, index) =>
                index % sampleInterval === 0 || index === rangeFiltered.length - 1
            );
        }

        return rangeFiltered;
    }, [data, selectedPeriod]);

    if (!data || data.length === 0) {
        return (
            <div className="glass-card p-6 rounded-2xl h-80 flex items-center justify-center border-dashed">
                <p className="text-muted-foreground">No data available for chart</p>
            </div>
        );
    }

    const periods: TimePeriod[] = ['1D', '1W', '1M', 'YTD', 'MAX'];

    return (
        <div className="glass-card p-6 rounded-2xl h-96 w-full">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">Performance</h3>

                {/* Time Period Filters */}
                <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg">
                    {periods.map((period) => (
                        <button
                            key={period}
                            onClick={() => setSelectedPeriod(period)}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${selectedPeriod === period
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                }`}
                        >
                            {period}
                        </button>
                    ))}
                </div>
            </div>

            <div className="w-full h-full pb-6">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredData}>
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
                        <ReferenceLine
                            y={filteredData.length > 0 ? filteredData[0].value : 0}
                            stroke="#888888"
                            strokeDasharray="5 5"
                            strokeWidth={2}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
