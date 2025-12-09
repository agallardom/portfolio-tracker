"use client";

import { useState } from "react";
import { createPortfolio } from "@/actions/portfolio";
import { Plus } from "lucide-react";
// We would ideally use a Dialog component from a library like shadcn/ui or headless ui
// For now, I'll build a simple one or assume I can add shadcn/ui later.
// To keep it simple and dependency-free for now, I'll make a custom modal.

export function CreatePortfolioDialog() {
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState("");
    const [currency, setCurrency] = useState("EUR");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        await createPortfolio(name, currency);
        setLoading(false);
        setIsOpen(false);
        setName("");
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
                <Plus className="w-4 h-4" />
                Add Portfolio
            </button>
        );
    }

    return (
        <>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsOpen(false)}>
                <div className="bg-card border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                    <h2 className="text-xl font-bold mb-4">Create New Portfolio</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-muted-foreground">Portfolio Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                className="w-full bg-secondary/50 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="e.g. Long Term Holds"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1 text-muted-foreground">Currency</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCurrency("EUR")}
                                    className={`px-4 py-2 rounded-lg border ${currency === "EUR" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/20 border-white/10 hover:bg-secondary/40"}`}
                                >
                                    EUR (€)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrency("USD")}
                                    className={`px-4 py-2 rounded-lg border ${currency === "USD" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/20 border-white/10 hover:bg-secondary/40"}`}
                                >
                                    USD ($)
                                </button>
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
                                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                                disabled={loading}
                            >
                                {loading ? "Creating..." : "Create Portfolio"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}
