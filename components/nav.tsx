import Link from "next/link";
import { LayoutDashboard, PieChart, ArrowRightLeft, FileText } from "lucide-react";

export function Navigation() {
    return (
        <nav className="border-b border-white/10 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
            <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold">
                        P
                    </div>
                    <span className="font-bold text-lg tracking-tight">Portfolio</span>
                </div>

                <div className="flex items-center gap-1">
                    <Link href="/" className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                        <LayoutDashboard className="w-4 h-4" />
                        Dashboard
                    </Link>
                    <Link href="/transactions" className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                        <ArrowRightLeft className="w-4 h-4" />
                        Transactions
                    </Link>
                    <Link href="/reports" className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Reports
                    </Link>
                </div>
            </div>
        </nav>
    );
}
