'use client';

import { useState } from 'react';
import { generateOptimizationPrompt } from '@/actions/generate-prompt';
import { Sparkles, Copy, Loader2, Check, X } from 'lucide-react';

export function AiPromptDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [copied, setCopied] = useState(false);

    const handleOpen = async () => {
        setOpen(true);
        setLoading(true);
        try {
            const result = await generateOptimizationPrompt();
            if (result.success && result.prompt) {
                setPrompt(result.prompt);
            } else {
                setPrompt("Error generating prompt. Please try again.");
            }
        } catch (e) {
            setPrompt("An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(prompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!open) {
        return (
            <button
                onClick={handleOpen}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors flex items-center gap-2"
            >
                <Sparkles className="w-4 h-4 text-purple-400" />
                AI Prompt
            </button>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
            <div
                className="bg-card border border-white/10 text-card-foreground shadow-lg rounded-xl w-full max-w-3xl flex flex-col pointer-events-auto max-h-[85vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex flex-col space-y-1.5 p-6 pb-4 border-b border-white/5">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-semibold leading-none tracking-tight flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-purple-500" />
                            AI Optimization Prompt
                        </h3>
                        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                        Copy and paste this into ChatGPT or Claude for a deep portfolio analysis.
                    </p>
                </div>

                <div className="p-0 flex-1 overflow-hidden relative bg-black/20">
                    {/* Scrollable Content Area */}
                    <div className="absolute inset-0 overflow-y-auto p-6">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <p>Analyzing portfolio...</p>
                            </div>
                        ) : (
                            <pre className="whitespace-pre-wrap font-mono text-xs sm:text-sm text-foreground/90 leading-relaxed">
                                {prompt}
                            </pre>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-white/5 flex justify-end gap-3 bg-card rounded-b-xl">
                    <button
                        onClick={() => setOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={copyToClipboard}
                        disabled={loading || !prompt}
                        className={`inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none px-6 py-2 min-w-[120px] gap-2
                        ${copied
                                ? "bg-green-500/20 text-green-400 border border-green-500/50"
                                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-purple-500/20"
                            }`}
                    >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? "Copied!" : "Copy Prompt"}
                    </button>
                </div>
            </div>
        </div>
    );
}
