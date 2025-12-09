"use client";

import { deleteTransaction } from "@/actions/transaction";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteTransactionButton({ transactionId }: { transactionId: string }) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleDelete() {
        if (!confirm("Are you sure you want to delete this transaction? This action cannot be undone.")) {
            return;
        }

        setLoading(true);
        try {
            const result = await deleteTransaction(transactionId);
            if (!result.success) {
                alert("Failed to delete transaction: " + result.error);
            } else {
                router.refresh();
            }
        } catch (error) {
            console.error("Failed to delete transaction", error);
            alert("An error occurred");
        } finally {
            setLoading(false);
        }
    }

    return (
        <button
            onClick={handleDelete}
            disabled={loading}
            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-muted-foreground hover:text-red-400"
            title="Delete Transaction"
        >
            <Trash2 className="w-4 h-4" />
        </button>
    );
}
