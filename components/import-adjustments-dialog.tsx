'use client';

import { useState, useTransition, useEffect } from 'react';
import { createPortal } from "react-dom";
import { Upload, Loader2, FileJson } from 'lucide-react';
import { applyAdjustments } from '@/actions/adjustments';
import { useRouter } from 'next/navigation';

interface ImportAdjustmentsDialogProps {
    portfolioId: string;
}

export function ImportAdjustmentsDialog({ portfolioId }: ImportAdjustmentsDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        setMounted(true);
    }, []);

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setSuccess(null);

        const formData = new FormData(event.currentTarget);
        const file = formData.get('file') as File;

        if (!file || file.size === 0) {
            setError('Please select a valid JSON file.');
            return;
        }

        const text = await file.text();

        startTransition(async () => {
            const result = await applyAdjustments(portfolioId, text);
            if (result.success) {
                setSuccess(result.message || 'Adjustments applied successfully.');
                setTimeout(() => {
                    setIsOpen(false);
                    setSuccess(null);
                    router.refresh();
                }, 1500);
            } else {
                setError(result.error || 'Failed to apply adjustments.');
            }
        });
    }

    const modalContent = (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsOpen(false)}>
            <div className="bg-card border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-2">Import Adjustments</h2>
                <p className="text-sm text-muted-foreground mb-4">
                    Upload your eToro adjustments JSON file ("eToro_ajustes.json"). This will update asset prices and exchange rates.
                </p>

                <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                        <input
                            id="file"
                            name="file"
                            type="file"
                            accept=".json"
                            disabled={isPending}
                            className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80 cursor-pointer border border-white/10 rounded-lg p-2 bg-secondary/20"
                        />
                    </div>

                    {error && (
                        <div className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="text-sm text-green-400 bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                            {success}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 mt-6">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                            disabled={isPending}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                            disabled={isPending}
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Importing...
                                </>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4" />
                                    Start Import
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors flex items-center gap-2"
            >
                <FileJson className="w-4 h-4" />
                Import Adjustments
            </button>
            {isOpen && mounted && createPortal(modalContent, document.body)}
        </>
    );
}
