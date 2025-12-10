"use client";

import React, { useState } from "react";

type AssetBreakdown = {
    symbol: string;
    name: string;
    quantity: number;
    currentPrice: number;
    currentPriceConverted?: number;
    quoteCurrency?: string;
    exchangeRate?: number;
    avgCostPerShare: number;
    totalCost: number;
    currentValue: number;
    unrealizedGain: number;
    unrealizedGainPercent: number;
    realizedGain: number;
    totalGain: number;
    dividends: number;
    firstPurchaseDate: Date | null;
    allocationPercent: number;
};

type SortKey = keyof AssetBreakdown;
type SortDirection = 'asc' | 'desc';

export function AssetBreakdownTable({
    data,
    currency
}: {
    data: AssetBreakdown[];
    currency: string;
}) {
    const [sortKey, setSortKey] = useState<SortKey>('currentValue');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    if (!data || data.length === 0) {
        return (
            <div className="glass-card p-6 rounded-2xl border-dashed">
                <p className="text-muted-foreground text-center">No assets in portfolio</p>
            </div>
        );
    }

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('desc');
        }
    };

    const toggleRow = (symbol: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(symbol)) {
            newExpanded.delete(symbol);
        } else {
            newExpanded.add(symbol);
        }
        setExpandedRows(newExpanded);
    };

    const sortedData = [...data].sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];

        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return sortDirection === 'asc'
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
        }

        return 0;
    });

    const SortIcon = ({ column }: { column: SortKey }) => {
        if (sortKey !== column) {
            return <span className="text-muted-foreground/30">↕</span>;
        }
        return <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-white/5 text-muted-foreground border-b border-white/10">
                        <tr>
                            <th className="px-6 py-3 text-left font-medium">
                                <button
                                    onClick={() => handleSort('symbol')}
                                    className="flex items-center gap-2 hover:text-foreground transition-colors"
                                >
                                    Asset <SortIcon column="symbol" />
                                </button>
                            </th>
                            <th className="px-6 py-3 text-right font-medium">
                                <button
                                    onClick={() => handleSort('quantity')}
                                    className="flex items-center gap-2 ml-auto hover:text-foreground transition-colors"
                                >
                                    Quantity <SortIcon column="quantity" />
                                </button>
                            </th>
                            <th className="px-6 py-3 text-right font-medium">
                                <button
                                    onClick={() => handleSort('totalCost')}
                                    className="flex items-center gap-2 ml-auto hover:text-foreground transition-colors"
                                >
                                    Cost Basis <SortIcon column="totalCost" />
                                </button>
                            </th>
                            <th className="px-6 py-3 text-right font-medium">
                                <button
                                    onClick={() => handleSort('currentValue')}
                                    className="flex items-center gap-2 ml-auto hover:text-foreground transition-colors"
                                >
                                    Market Value <SortIcon column="currentValue" />
                                </button>
                            </th>
                            <th className="px-6 py-3 text-right font-medium">
                                <button
                                    onClick={() => handleSort('totalGain')}
                                    className="flex items-center gap-2 ml-auto hover:text-foreground transition-colors"
                                >
                                    Total Gain <SortIcon column="totalGain" />
                                </button>
                            </th>
                            <th className="px-6 py-3 text-right font-medium">
                                <button
                                    onClick={() => handleSort('allocationPercent')}
                                    className="flex items-center gap-2 ml-auto hover:text-foreground transition-colors"
                                >
                                    Allocation <SortIcon column="allocationPercent" />
                                </button>
                            </th>
                            <th className="px-6 py-3 text-center font-medium">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {sortedData.map((asset) => {
                            const isExpanded = expandedRows.has(asset.symbol);
                            return (
                                <React.Fragment key={asset.symbol}>
                                    <tr className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="font-medium">{asset.symbol}</div>
                                                <div className="text-xs text-muted-foreground">{asset.name}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono">
                                            {asset.quantity.toFixed(4)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="font-mono font-medium">{asset.totalCost.toFixed(2)} {currency}</div>
                                            <div className="text-xs text-muted-foreground">
                                                @ {asset.avgCostPerShare.toFixed(2)} {currency}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="font-mono font-medium">{asset.currentValue.toFixed(2)} {currency}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {asset.quoteCurrency && asset.quoteCurrency !== currency ? (
                                                    <span title={`Exchange rate: ${asset.exchangeRate?.toFixed(4)}`}>
                                                        @ {asset.currentPrice.toFixed(2)} {asset.quoteCurrency} ({asset.currentPriceConverted?.toFixed(2)} {currency})
                                                    </span>
                                                ) : (
                                                    <span>@ {asset.currentPrice.toFixed(2)} {currency}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className={`font-mono font-medium ${asset.totalGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {asset.totalGain >= 0 ? '+' : ''}{asset.totalGain.toFixed(2)} {currency}
                                            </div>
                                            {asset.quantity > 0 && (
                                                <div className={`text-xs ${asset.unrealizedGainPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {asset.unrealizedGainPercent >= 0 ? '+' : ''}{asset.unrealizedGainPercent.toFixed(2)}%
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary rounded-full"
                                                        style={{ width: `${Math.min(asset.allocationPercent, 100)}%` }}
                                                    />
                                                </div>
                                                <span className="font-mono text-xs w-12 text-right">
                                                    {asset.allocationPercent.toFixed(1)}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => toggleRow(asset.symbol)}
                                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="16"
                                                    height="16"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                >
                                                    <polyline points="6 9 12 15 18 9"></polyline>
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="bg-white/5">
                                            <td colSpan={7} className="px-6 py-4">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    <div>
                                                        <div className="text-xs text-muted-foreground mb-1">Avg Cost/Share</div>
                                                        <div className="font-mono">{asset.avgCostPerShare.toFixed(2)} {currency}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground mb-1">Total Cost</div>
                                                        <div className="font-mono">{asset.totalCost.toFixed(2)} {currency}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground mb-1">Unrealized Gain</div>
                                                        <div className={`font-mono ${asset.unrealizedGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {asset.unrealizedGain >= 0 ? '+' : ''}{asset.unrealizedGain.toFixed(2)} {currency}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground mb-1">Realized Gain</div>
                                                        <div className={`font-mono ${asset.realizedGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {asset.realizedGain >= 0 ? '+' : ''}{asset.realizedGain.toFixed(2)} {currency}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground mb-1">Dividends</div>
                                                        <div className="font-mono text-blue-400">
                                                            {asset.dividends > 0 ? '+' : ''}{asset.dividends.toFixed(2)} {currency}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground mb-1">First Purchase</div>
                                                        <div className="text-sm">
                                                            {asset.firstPurchaseDate
                                                                ? new Date(asset.firstPurchaseDate).toLocaleDateString()
                                                                : 'N/A'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
