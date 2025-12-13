import { Navigation } from "@/components/nav";
import { getTransactions } from "@/actions/transaction";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { CreateTransactionDialog } from "@/components/create-transaction-dialog";
import { getPortfolioSummary, getPortfolioHistory, getAssetBreakdown } from "@/actions/portfolio";
import { PortfolioChart } from "@/components/portfolio-chart";
import { RefreshPricesButton } from "@/components/refresh-prices-button";
import { DeleteTransactionButton } from "@/components/delete-transaction-button";
import { AssetBreakdownTable } from "@/components/asset-breakdown-table";
import { PortfolioAllocationModal } from "@/components/portfolio-allocation-modal";
import { ImportTransactionsDialog } from "@/components/import-transactions-dialog";

// ... (previous imports)
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ... (previous imports)
import { PaginationControls } from "@/components/pagination-controls";

export default async function PortfolioPage({
    params,
    searchParams
}: {
    params: { id: string },
    searchParams: { page?: string, pageSize?: string }
}) {
    const { id } = await params;
    const { page, pageSize } = await searchParams; // Next 15 searchParams are async

    // Parse pagination params
    const currentPage = Number(page) || 1;
    const itemsPerPage = Number(pageSize) || 10; // Default to 10 as requested (was 20)

    const portfolio = await prisma.portfolio.findUnique({
        where: { id },
    });

    if (!portfolio) {
        notFound();
    }

    // Fetch transactions with pagination
    const { data: transactions, metadata } = await getTransactions(id, currentPage, itemsPerPage);
    const { data: summary } = await getPortfolioSummary(id);
    const history = await getPortfolioHistory(id);
    const { data: assetBreakdown } = await getAssetBreakdown(id);

    return (
        <div className="min-h-screen bg-background relative overflow-hidden">
            <Navigation />

            <main className="container mx-auto px-6 py-8">
                <header className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2">{portfolio.name}</h1>
                        <p className="text-muted-foreground">
                            {portfolio.currency} Portfolio • {metadata?.total || 0} Transactions
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <RefreshPricesButton portfolioId={portfolio.id} />
                        <ImportTransactionsDialog portfolioId={portfolio.id} />
                        <CreateTransactionDialog portfolioId={portfolio.id} currency={portfolio.currency} />
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content (Chart & Stats) */}
                    <div className="lg:col-span-2 space-y-8">
                        <PortfolioChart data={history?.data || []} />
                    </div>

                    {/* Sidebar (Holdings & Summary) */}
                    <div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 lg:grid-cols-2">
                            <div className="bg-card glass-card p-4 rounded-xl">
                                <div className="text-sm text-muted-foreground mb-1">Total Value</div>
                                <div className="text-2xl font-bold font-mono">
                                    {summary?.currentValue.toFixed(2)} <span className="text-sm text-muted-foreground">{portfolio?.currency}</span>
                                </div>
                            </div>
                            <div className="bg-card glass-card p-4 rounded-xl">
                                <div className="text-sm text-muted-foreground mb-1">Net Invested</div>
                                <div className="text-2xl font-bold font-mono">
                                    {summary?.totalInvested.toFixed(2)} <span className="text-sm text-muted-foreground">{portfolio?.currency}</span>
                                </div>
                            </div>
                            <div className="bg-card glass-card p-4 rounded-xl">
                                <div className="text-sm text-muted-foreground mb-1">Total Gain</div>
                                <div className={`text-2xl font-bold font-mono ${summary?.totalGain != undefined && summary?.totalGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {summary?.totalGain != undefined && summary?.totalGain >= 0 ? '+' : ''}{summary?.totalGain.toFixed(2)} <span className="text-sm text-muted-foreground">{portfolio?.currency}</span>
                                </div>
                                <div className={`text-sm ${summary?.totalGainPercent != undefined && summary?.totalGainPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {summary?.totalGainPercent.toFixed(2)}% ROI
                                </div>
                            </div>
                            <div className="bg-card glass-card p-4 rounded-xl border-primary/20 bg-primary/5">
                                <div className="text-sm text-primary mb-1 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-wallet"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></svg>
                                    Cash Available
                                </div>
                                <div className="text-2xl font-bold font-mono text-primary">
                                    {summary?.cashBalance.toFixed(2)} <span className="text-sm text-primary/70">{portfolio?.currency}</span>
                                </div>
                            </div>
                        </div>

                        {/* Breakdown by Source Currency */}
                        {(summary?.totalInvestedEUR ? summary.totalInvestedEUR > 0 : false) || (summary?.totalInvestedUSD ? summary.totalInvestedUSD > 0 : false) ? (
                            <div className="grid grid-cols-2 gap-4 mt-4 lg:grid-cols-2">
                                <div className="bg-secondary/20 p-3 rounded-lg flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Invested (EUR Source)</span>
                                    <span className="font-mono">{summary?.totalInvestedEUR?.toFixed(2) || '0.00'} €</span>
                                </div>
                                <div className="bg-secondary/20 p-3 rounded-lg flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Invested (USD Source)</span>
                                    <span className="font-mono">{summary?.totalInvestedUSD?.toFixed(2) || '0.00'} $</span>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Asset Breakdown Table - Full Width */}
                <div className="mt-8">
                    <div className="flex items-center gap-2 mb-6">
                        <h2 className="text-xl font-semibold">Asset Breakdown</h2>
                        <PortfolioAllocationModal
                            data={assetBreakdown || []}
                            currency={portfolio.currency}
                        />
                    </div>
                    <AssetBreakdownTable
                        data={assetBreakdown || []}
                        currency={portfolio.currency}
                        portfolioId={portfolio.id}
                    />
                </div>

                {/* Recent Transactions List (Moved to bottom) */}
                <div id="transactions-section" className="mt-12">
                    <h2 className="text-xl font-semibold mb-4">Recent Transactions</h2>
                    <div className="glass-card rounded-2xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-white/5 text-muted-foreground border-b border-white/10">
                                <tr>
                                    <th className="px-6 py-3 text-left font-medium">Date & Time</th>
                                    <th className="px-6 py-3 text-left font-medium">Type</th>
                                    <th className="px-6 py-3 text-left font-medium">Asset</th>
                                    <th className="px-6 py-3 text-right font-medium">Amount</th>
                                    <th className="px-6 py-3 text-right font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {transactions?.map((tx: any) => (
                                    <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium">{new Date(tx.date).toLocaleDateString()}</span>
                                                <span className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${tx.type === 'BUY' ? 'bg-green-500/10 text-green-400' :
                                                tx.type === 'SELL' ? 'bg-red-500/10 text-red-400' :
                                                    'bg-blue-500/10 text-blue-400'
                                                }`}>
                                                {tx.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-medium">{tx.assetSymbol || '-'}</td>
                                        <td className="px-6 py-4 text-right font-mono">
                                            {tx.amount.toFixed(2)} {tx.currency}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <CreateTransactionDialog
                                                    portfolioId={portfolio.id}
                                                    currency={portfolio.currency}
                                                    transaction={tx}
                                                    trigger={
                                                        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                                        </button>
                                                    }
                                                />
                                                <DeleteTransactionButton transactionId={tx.id} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {(!transactions || transactions.length === 0) && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                            No transactions found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* Pagination Controls */}
                        {metadata && (
                            <PaginationControls
                                total={metadata.total}
                                page={metadata.page}
                                pageSize={metadata.pageSize}
                                totalPages={metadata.totalPages}
                                hasNextPage={metadata.hasNextPage}
                                hasPreviousPage={metadata.hasPreviousPage}
                            />
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
