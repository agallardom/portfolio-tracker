"use client";

import { useState, useEffect, useRef } from "react";
import { searchAssets } from "@/actions/asset";
import { Search } from "lucide-react";

interface AssetSearchProps {
    onSelect: (symbol: string) => void;
    initialValue?: string;
}

export function AssetSearch({ onSelect, initialValue = "" }: AssetSearchProps) {
    const [query, setQuery] = useState(initialValue);
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length >= 2) {
                setLoading(true);
                const res = await searchAssets(query);
                if (res.success && res.results) {
                    setResults(res.results);
                    setIsOpen(true);
                }
                setLoading(false);
            } else {
                setResults([]);
                setIsOpen(false);
            }
        }, 500); // Debounce 500ms

        return () => clearTimeout(timer);
    }, [query]);

    function handleSelect(symbol: string) {
        setQuery(symbol);
        onSelect(symbol);
        setIsOpen(false);
    }

    return (
        <div className="relative" ref={wrapperRef}>
            <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        onSelect(e.target.value); // Update parent even if not selected from dropdown
                    }}
                    placeholder="Search asset (e.g. AAPL, BTC-USD)"
                    className="w-full bg-secondary/50 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {loading && (
                    <div className="absolute right-3 top-3">
                        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                    </div>
                )}
            </div>

            {isOpen && results.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-card border border-white/10 rounded-lg shadow-xl max-h-60 overflow-auto">
                    {results.map((result: any) => (
                        <button
                            key={result.symbol}
                            className="w-full text-left px-4 py-2 hover:bg-white/5 transition-colors flex flex-col"
                            onClick={() => handleSelect(result.symbol)}
                        >
                            <span className="font-bold text-white">{result.symbol}</span>
                            <span className="text-xs text-muted-foreground">
                                {result.name} ({result.exchange})
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
