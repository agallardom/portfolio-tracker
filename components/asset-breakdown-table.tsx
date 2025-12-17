"use client";

import React, { useState } from "react";
import { CreateTransactionDialog } from "./create-transaction-dialog";
import { DeleteTransactionButton } from "./delete-transaction-button";
import { TickerLogo } from "@/components/ticker-logo";

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
    transactions?: any[];
};

type SortKey = keyof AssetBreakdown;
type SortDirection = 'asc' | 'desc';

export function AssetBreakdownTable({
    data,
    currency,
    portfolioId
}: {
    data: AssetBreakdown[];
    currency: string;
    portfolioId: string;
}) {
    const [sortKey, setSortKey] = useState<SortKey>('currentValue');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [showClosed, setShowClosed] = useState(false);

    if (!data || data.length === 0) {
        return (
            <div className="glass-card p-6 rounded-2xl border-dashed">
                <p className="text-muted-foreground text-center">No assets in portfolio</p>
            </div>
        );
    }

    const filteredData = data.filter(asset => {
        if (showClosed) return true;
        return asset.quantity > 0.000001; // Float tolerance
    });

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

    const sortedData = [...filteredData].sort((a, b) => {
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
        <div className="space-y-4">
            <div className="flex justify-end px-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                    <input
                        type="checkbox"
                        checked={showClosed}
                        onChange={(e) => setShowClosed(e.target.checked)}
                        className="rounded border-white/10 bg-secondary/20 text-primary focus:ring-primary/50"
                    />
                    Show Closed Positions
                </label>
            </div>

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
                                                <div className="flex items-center gap-3">
                                                    <TickerLogo symbol={asset.symbol} />
                                                    <div>
                                                        <div className="font-medium">{asset.symbol}</div>
                                                        <div className="text-xs text-muted-foreground">{asset.name}</div>
                                                    </div>
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
                                                    <div className="space-y-4">
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

                                                        {/* Embedded Transactions Table */}
                                                        <div className="mt-4 border-t border-white/10 pt-4">
                                                            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Transactions for {asset.symbol}</h4>
                                                            <div className="overflow-x-auto">
                                                                <table className="w-full text-xs text-left">
                                                                    <thead className="text-muted-foreground font-medium border-b border-white/10">
                                                                        <tr>
                                                                            <th className="px-4 py-2">Date</th>
                                                                            <th className="px-4 py-2">Type</th>
                                                                            <th className="px-4 py-2 text-right">Amnt</th>
                                                                            <th className="px-4 py-2 text-right">Qty</th>
                                                                            <th className="px-4 py-2 text-right">Price</th>
                                                                            <th className="px-4 py-2 text-right">Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-white/5">
                                                                        {asset.transactions?.map((tx: any) => (
                                                                            <tr key={tx.id} className="hover:bg-white/5">
                                                                                <td className="px-4 py-2 whitespace-nowrap">
                                                                                    {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                                </td>
                                                                                <td className="px-4 py-2">
                                                                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${tx.type === 'BUY' ? 'bg-green-500/10 text-green-400' :
                                                                                        tx.type === 'SELL' ? 'bg-red-500/10 text-red-400' :
                                                                                            'bg-blue-500/10 text-blue-400'
                                                                                        }`}>
                                                                                        {tx.type}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-4 py-2 text-right font-mono">
                                                                                    {tx.amount.toFixed(2)} {tx.currency}
                                                                                </td>
                                                                                <td className="px-4 py-2 text-right font-mono">
                                                                                    {tx.quantity ? tx.quantity.toFixed(4) : '-'}
                                                                                </td>
                                                                                <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                                                                                    {tx.pricePerUnit ? `@ ${tx.pricePerUnit.toFixed(2)}` : '-'}
                                                                                </td>
                                                                                <td className="px-4 py-2 text-right">
                                                                                    <div className="flex justify-end gap-1">
                                                                                        <CreateTransactionDialog
                                                                                            portfolioId={portfolioId}
                                                                                            currency={currency}
                                                                                            transaction={tx}
                                                                                            trigger={
                                                                                                <button className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-muted-foreground hover:text-foreground">
                                                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                                                                                </button>
                                                                                            }
                                                                                        />
                                                                                        <div className="scale-75 origin-right">
                                                                                            <DeleteTransactionButton transactionId={tx.id} />
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
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
        </div>
    );
}
