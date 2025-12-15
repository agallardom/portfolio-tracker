"use client";

import { deleteAllTransactions } from "@/actions/transaction";
import { Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteAllTransactionsButton({ portfolioId }: { portfolioId: string }) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleDelete() {
        if (!confirm("WARNING: Are you sure you want to DELETE ALL transactions in this portfolio?\n\nThis will reset the portfolio value to zero (except for cash adjustments if any remain, though typically everything is deleted).\n\nThis action CANNOT be undone.")) {
            return;
        }

        setLoading(true);
        try {
            const result = await deleteAllTransactions(portfolioId);
            if (!result.success) {
                alert("Failed to delete transactions: " + result.error);
            } else {
                router.refresh();
            }
        } catch (error) {
            console.error("Failed to delete transactions", error);
            alert("An error occurred");
        } finally {
            setLoading(false);
        }
    }

    return (
        <button
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-2"
            title="Delete All Transactions"
        >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Clear All
        </button>
    );
}
