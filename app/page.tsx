import { Navigation } from "@/components/nav";
import { getPortfolios, getDashboardSummary } from "@/actions/portfolio";
import Link from "next/link";
import { CreatePortfolioDialog } from "@/components/create-portfolio-dialog";
import { db } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function Home() {
  const session = await auth()

  if (!session?.user?.id) {
    // Should be handled by middleware but as safety
    redirect("/login")
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { riskProfile: true }
  })

  // If user has no risk profile (and is not ADMIN? No, admins should also have one or skip. 
  // Let's assume everyone needs one or only USER role. 
  // User request: "Al entrar con el token no redirecciona al onboarding".
  // So enforce for everyone for now.)
  if (!user?.riskProfile) {
    redirect("/onboarding")
  }

  const { data: portfolios } = await getPortfolios();
  const { data: summary } = await getDashboardSummary();

  const totalBalance = summary?.totalBalanceEUR || 0;
  const totalInvested = summary?.totalInvestedEUR || 0;
  const realizedPL = summary?.totalRealizedPLEUR || 0;
  const totalGainPercent = summary?.totalGainPercent || 0;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] opacity-50" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/20 rounded-full blur-[120px] opacity-50" />
      </div>

      <Navigation />

      <main className="container mx-auto px-6 py-8">
        <header className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Overview of your investments across {portfolios?.length || 0} portfolios.
          </p>
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Balance (Est. EUR)</h3>
            <p className="text-3xl font-bold">
              {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(totalBalance)}
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Invested</h3>
            <p className="text-3xl font-bold">
              {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(totalInvested)}
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Gain</h3>
            <p className={`text-3xl font-bold ${summary?.totalGainEUR != undefined && summary.totalGainEUR >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {summary?.totalGainEUR != undefined && summary.totalGainEUR >= 0 ? '+' : ''}
              {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(summary?.totalGainEUR || 0)}
            </p>
            <div className={`mt-4 flex items-center text-sm ${totalGainPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              <span>{totalGainPercent >= 0 ? '+' : ''}{totalGainPercent.toFixed(2)}% ROI</span>
            </div>
          </div>

          <div className="glass-card p-6 rounded-2xl">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Realized P/L</h3>
            <p className={`text-3xl font-bold ${realizedPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(realizedPL)}
            </p>
          </div>
        </div>

        {/* Portfolios Section */}
        <section>

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Portfolios</h2>
            <CreatePortfolioDialog />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {summary?.portfolios?.map((portfolio: { id: string, name: string, currency: string, currentValue: number, transactionCount: number }) => (
              <Link href={`/portfolio/${portfolio.id}`} key={portfolio.id} className="glass-card p-6 rounded-2xl hover:border-primary/50 transition-colors cursor-pointer block">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{portfolio.name}</h3>
                    <p className="text-sm text-muted-foreground">{portfolio.currency}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                    {/* Icon placeholder */}
                    <span className="text-xs font-bold">{portfolio.currency}</span>
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {new Intl.NumberFormat('en-IE', { style: 'currency', currency: portfolio.currency }).format(portfolio.currentValue)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{portfolio.transactionCount} transactions</p>
                </div>
              </Link>
            ))}

            {(!portfolios || portfolios.length === 0) && (
              <div className="col-span-full py-12 text-center border border-dashed border-white/10 rounded-2xl">
                <p className="text-muted-foreground">No portfolios found. Create one to get started.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
