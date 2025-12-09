"use client";

import { updatePortfolioPrices } from "@/actions/asset";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function RefreshPricesButton({ portfolioId }: { portfolioId: string }) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleRefresh() {
        console.log("Refresh button clicked");
        setLoading(true);
        try {
            console.log("Calling updatePortfolioPrices...");
            const result: any = await updatePortfolioPrices(portfolioId);
            console.log("updatePortfolioPrices result:", result);

            if (result.results) {
                const debugInfo = result.results.map((r: any) => `${r.symbol}: ${r.status} ${r.error ? '(' + r.error + ')' : ''} ${r.price ? '(' + r.price + ')' : ''}`).join('\n');
                alert(`Update Results:\n${debugInfo}`);
            } else if (result.message) {
                alert(`Message: ${result.message}`);
            } else {
                alert(`Updated count: ${result.updatedCount}`);
            }

            router.refresh();
        } catch (error) {
            console.error("Failed to refresh prices", error);
            alert("Failed to refresh: " + error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 bg-secondary/50 text-secondary-foreground rounded-lg hover:bg-secondary/70 transition-colors disabled:opacity-50"
            title="Refresh Asset Prices"
        >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
    );
}
