import { Navigation } from "@/components/nav";
import { getTransactions } from "@/actions/transaction";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { CreateTransactionDialog } from "@/components/create-transaction-dialog";
import { getPortfolioSummary, getPortfolioHistory } from "@/actions/portfolio";
import { PortfolioChart } from "@/components/portfolio-chart";

export default async function PortfolioPage({ params }: { params: { id: string } }) {
    const { id } = await params; // Next.js 15+ params are async

    const portfolio = await prisma.portfolio.findUnique({
        where: { id },
    });

    if (!portfolio) {
        notFound();
    }

    const { data: transactions } = await getTransactions(id);
    const { data: summary } = await getPortfolioSummary(id);
    const history = await getPortfolioHistory(id);

    return (
        <div className="min-h-screen bg-background relative overflow-hidden">
            <Navigation />

            <main className="container mx-auto px-6 py-8">
                <header className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2">{portfolio.name}</h1>
                        <p className="text-muted-foreground">
                            {portfolio.currency} Portfolio • {transactions?.length || 0} Transactions
                        </p>
                    </div>
                    <CreateTransactionDialog portfolioId={portfolio.id} currency={portfolio.currency} />
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content (Chart & Stats) */}
                    <div className="lg:col-span-2 space-y-8">
                        <PortfolioChart data={history?.data || []} />

                        {/* Recent Transactions List */}
                        <div>
                            <h2 className="text-xl font-semibold mb-4">Recent Transactions</h2>
                            <div className="glass-card rounded-2xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-white/5 text-muted-foreground border-b border-white/10">
                                        <tr>
                                            <th className="px-6 py-3 text-left font-medium">Date</th>
                                            <th className="px-6 py-3 text-left font-medium">Type</th>
                                            <th className="px-6 py-3 text-left font-medium">Asset</th>
                                            <th className="px-6 py-3 text-right font-medium">Amount</th>
                                            <th className="px-6 py-3 text-right font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {transactions?.map((tx: any) => (
                                            <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4">{new Date(tx.date).toLocaleDateString()}</td>
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
                                                </td>
                                            </tr>
                                        ))}
                                        {(!transactions || transactions.length === 0) && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                                    No transactions yet.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar (Holdings & Summary) */}
                    <div className="space-y-6">
                        <div className="glass-card p-6 rounded-2xl">
                            <h3 className="text-sm font-medium text-muted-foreground mb-4">Portfolio Summary</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Total Invested</span>
                                    <span className="font-mono">{summary?.totalInvested.toFixed(2) ?? "0.00"} {portfolio.currency}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Current Value</span>
                                    <span className="font-mono font-bold">{summary?.currentValue.toFixed(2) ?? "0.00"} {portfolio.currency}</span>
                                </div>
                                <div className={`pt-4 border-t border-white/10 flex justify-between items-center ${(summary?.unrealizedPL ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                                    <span>P/L</span>
                                    <span className="font-mono">
                                        {(summary?.unrealizedPL ?? 0) >= 0 ? "+" : ""}{(summary?.unrealizedPL ?? 0).toFixed(2)} ({(summary?.roi ?? 0).toFixed(2)}%)
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
