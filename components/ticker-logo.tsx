"use client"

import { useState } from "react"

export function TickerLogo({ symbol }: { symbol: string }) {
    const [error, setError] = useState(false)

    // Using a reliable financial logo source or fallback
    // e.g. https://assets.parqet.com/logos/symbol/{symbol}?format=png
    const logoUrl = `https://assets.parqet.com/logos/symbol/${symbol}?format=png`

    if (error) {
        return (
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">
                {symbol.substring(0, 2).toUpperCase()}
            </div>
        )
    }

    return (
        <div className="w-8 h-8 rounded-full bg-white overflow-hidden shrink-0 flex items-center justify-center">
            <img
                src={logoUrl}
                alt={symbol}
                onError={() => setError(true)}
                className="w-full h-full object-contain"
            />
        </div>
    )
}
