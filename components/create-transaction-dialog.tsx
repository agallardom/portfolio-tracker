"use client";

import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { createTransaction, updateTransaction } from "@/actions/transaction";
import { Plus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type Transaction = {
    id: string;
    date: Date;
    type: string;
    amount: number;
    currency: string;
    assetSymbol?: string | null;
    pricePerUnit?: number | null;
    quantity?: number | null;
    fee?: number | null;
    portfolioId: string;
};

type CreateTransactionDialogProps = {
    portfolioId: string;
    currency: string;
    transaction?: Transaction; // Added for edit mode
    trigger?: React.ReactNode; // Custom trigger button
};

export function CreateTransactionDialog({ portfolioId, currency, transaction, trigger }: CreateTransactionDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    const router = useRouter();

    const isEditMode = !!transaction;

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split("T")[0],
        type: "BUY",
        assetSymbol: "",
        amount: "",
        currency: currency,
        pricePerUnit: "",
        quantity: "",
        fee: "",
    });

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (transaction && isOpen) {
            setFormData({
                date: new Date(transaction.date).toISOString().split("T")[0],
                type: transaction.type,
                assetSymbol: transaction.assetSymbol || "",
                amount: transaction.amount.toString(),
                currency: transaction.currency,
                pricePerUnit: transaction.pricePerUnit?.toString() || "",
                quantity: transaction.quantity?.toString() || "",
                fee: transaction.fee?.toString() || "",
            });
        } else if (!transaction && isOpen) {
            // Reset form for create mode
            setFormData({
                date: new Date().toISOString().split("T")[0],
                type: "BUY",
                assetSymbol: "",
                amount: "",
                currency: currency,
                pricePerUnit: "",
                quantity: "",
                fee: "",
            });
        }
    }, [transaction, isOpen, currency]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            const data = {
                date: new Date(formData.date),
                type: formData.type,
                amount: parseFloat(formData.amount),
                currency: formData.currency,
                assetSymbol: formData.assetSymbol || undefined,
                pricePerUnit: formData.pricePerUnit ? parseFloat(formData.pricePerUnit) : undefined,
                quantity: formData.quantity ? parseFloat(formData.quantity) : undefined,
                fee: formData.fee ? parseFloat(formData.fee) : undefined,
                portfolioId,
            };

            if (isEditMode && transaction) {
                await updateTransaction(transaction.id, data);
            } else {
                await createTransaction(data);
            }

            setIsOpen(false);
            if (!isEditMode) {
                setFormData({
                    date: new Date().toISOString().split("T")[0],
                    type: "BUY",
                    assetSymbol: "",
                    amount: "",
                    currency: currency,
                    pricePerUnit: "",
                    quantity: "",
                    fee: "",
                });
            }
            router.refresh();
        } catch (error) {
            console.error("Failed to save transaction", error);
        } finally {
            setLoading(false);
        }
    }

    const modalContent = (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsOpen(false)}>
            <div className="bg-card border border-white/10 p-6 rounded-2xl w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">{isEditMode ? "Edit Transaction" : "Add Transaction"}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-muted-foreground">Date</label>
                            <input
                                type="date"
                                name="date"
                                value={formData.date}
                                onChange={handleChange}
                                required
                                className="w-full bg-secondary/50 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-muted-foreground">Type</label>
                            <select
                                name="type"
                                value={formData.type}
                                onChange={handleChange}
                                className="w-full bg-secondary/50 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                <option value="BUY">Buy</option>
                                <option value="SELL">Sell</option>
                                <option value="DIVIDEND">Dividend</option>
                                <option value="SAVEBACK">SaveBack</option>
                                <option value="ROUNDUP">RoundUp</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-muted-foreground">Asset Symbol</label>
                        <input
                            type="text"
                            name="assetSymbol"
                            value={formData.assetSymbol}
                            onChange={handleChange}
                            placeholder="e.g. AAPL, BTC, S&P500"
                            className="w-full bg-secondary/50 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-muted-foreground">Total Amount ({formData.currency})</label>
                            <input
                                type="number"
                                step="0.01"
                                name="amount"
                                value={formData.amount}
                                onChange={handleChange}
                                required
                                placeholder="0.00"
                                className="w-full bg-secondary/50 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-muted-foreground">Fee ({formData.currency})</label>
                            <input
                                type="number"
                                step="0.01"
                                name="fee"
                                value={formData.fee}
                                onChange={handleChange}
                                placeholder="0.00"
                                className="w-full bg-secondary/50 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-muted-foreground">Quantity</label>
                            <input
                                type="number"
                                step="any"
                                name="quantity"
                                value={formData.quantity}
                                onChange={handleChange}
                                placeholder="0"
                                className="w-full bg-secondary/50 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-muted-foreground">Price Per Unit</label>
                            <input
                                type="number"
                                step="any"
                                name="pricePerUnit"
                                value={formData.pricePerUnit}
                                onChange={handleChange}
                                placeholder="0.00"
                                className="w-full bg-secondary/50 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                            disabled={loading}
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {loading ? (isEditMode ? "Saving..." : "Adding...") : (isEditMode ? "Save Changes" : "Add Transaction")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    return (
        <>
            {trigger ? (
                <div onClick={() => setIsOpen(true)} className="cursor-pointer inline-block">
                    {trigger}
                </div>
            ) : (
                <button
                    onClick={() => setIsOpen(true)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Add Transaction
                </button>
            )}
            {isOpen && mounted && createPortal(modalContent, document.body)}
        </>
    );
}
