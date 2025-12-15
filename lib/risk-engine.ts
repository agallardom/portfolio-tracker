
export type RiskProfile = "Conservative" | "Moderate" | "Balanced" | "Dynamic" | "Aggressive"

export const RISK_PROFILES: RiskProfile[] = ["Conservative", "Moderate", "Balanced", "Dynamic", "Aggressive"]

export const BENCHMARK_ALLOCATION: Record<RiskProfile, { fixed: [number, number], equity: [number, number] }> = {
    Conservative: { fixed: [80, 100], equity: [0, 20] },
    Moderate: { fixed: [65, 80], equity: [20, 35] },
    Balanced: { fixed: [40, 60], equity: [40, 60] },
    Dynamic: { fixed: [20, 35], equity: [65, 80] },
    Aggressive: { fixed: [0, 20], equity: [80, 100] },
}

// Question Definition
export interface Question {
    id: string
    text: string
    options: { label: string; points: number }[]
    block: "I" | "II" | "III"
}

export const QUESTIONS: Question[] = [
    // BLOCK I: Experience (Max 20)
    {
        id: "q1",
        block: "I",
        text: "¿Ha invertido alguna vez en productos considerados complejos (ej. derivados, futuros)?",
        options: [
            { label: "No, nunca", points: 0 }, // Low
            { label: "He leído sobre ello pero no invertido", points: 2 },
            { label: "Sí, ocasionalmente", points: 3 },
            { label: "Sí, frecuentemente", points: 5 }, // Max
        ]
    },
    {
        id: "q2",
        block: "I",
        text: "¿Cuántas operaciones de compra/venta realiza típicamente al año?",
        options: [
            { label: "0 - 5", points: 0 },
            { label: "5 - 20", points: 2 },
            { label: "20 - 50", points: 4 },
            { label: "Más de 50", points: 5 },
        ]
    },
    {
        id: "q3",
        block: "I",
        text: "¿Durante cuánto tiempo ha mantenido usted mismo una cartera gestionada?",
        options: [
            { label: "Menos de 1 año", points: 0 },
            { label: "1 - 3 años", points: 2 },
            { label: "3 - 5 años", points: 4 },
            { label: "Más de 5 años", points: 5 },
        ]
    },
    {
        id: "q4",
        block: "I",
        text: "¿Cómo se informa usted sobre los mercados financieros?",
        options: [
            { label: "No me informo / Amigos", points: 0 },
            { label: "Prensa generalista", points: 2 },
            { label: "Prensa económica especializada", points: 3 },
            { label: "Informes profesionales y análisis técnico", points: 5 },
        ]
    },

    // BLOCK II: Financial Situation (Max 21)
    {
        id: "q5",
        block: "II",
        text: "¿Considera que su fuente de ingresos es estable y garantizada para los próximos 5 años?",
        options: [
            { label: "No / Incierta", points: 0 },
            { label: "Algo estable", points: 2 },
            { label: "Muy estable", points: 4 },
            { label: "Garantizada (Funcionario/Rentas)", points: 5 },
        ]
    },
    {
        id: "q6",
        block: "II",
        text: "¿Qué probabilidad existe de que necesite acceder a este capital invertido en los próximos 3 años?",
        options: [
            { label: "Alta (Lo necesitaré seguro)", points: 0 },
            { label: "Media (Posiblemente)", points: 2 },
            { label: "Baja (Improbable)", points: 4 },
            { label: "Nula (Es capital a largo plazo)", points: 5 },
        ]
    },
    {
        id: "q7",
        block: "II",
        text: "¿Qué porcentaje de sus ingresos netos mensuales puede destinar al ahorro e inversión?",
        options: [
            { label: "Menos del 10%", points: 0 },
            { label: "10% - 20%", points: 2 },
            { label: "20% - 40%", points: 4 },
            { label: "Más del 40%", points: 5 },
        ]
    },
    {
        id: "q8",
        block: "II",
        text: "¿Cuál es su objetivo principal para este capital?",
        options: [
            { label: "Preservación estricta (Evitar pérdidas)", points: 0 },
            { label: "Protección contra inflación", points: 2 },
            { label: "Crecimiento moderado", points: 4 },
            { label: "Maximizar crecimiento (Aceptando volatilidad)", points: 6 }, // Max 6
        ]
    },

    // BLOCK III: Tolerance (Max 14)
    {
        id: "q9",
        block: "III",
        text: "Si su inversión de 10.000€ cae a 7.500€ (-25%) en un mes, ¿qué acción tomaría?",
        options: [
            { label: "Vender todo para evitar más pérdidas", points: 0 },
            { label: "Vender una parte", points: 2 },
            { label: "Esperar a que se recupere (No hacer nada)", points: 5 },
            { label: "Comprar más (Aprovechar la baja)", points: 8 }, // Max 8
        ]
    },
    {
        id: "q10",
        block: "III",
        text: "En igualdad de condiciones, ¿qué resultado prefiere?",
        options: [
            { label: "Ganar 2% seguro", points: 0 },
            { label: "Posibilidad de ganar 5% o perder 2%", points: 2 },
            { label: "Posibilidad de ganar 15% o perder 10%", points: 4 },
            { label: "Posibilidad de ganar 30% o perder 25%", points: 6 }, // Max 6
        ]
    }
]

export function calculateRiskScore(answers: Record<string, number>): number {
    let total = 0
    for (const q of QUESTIONS) {
        total += answers[q.id] || 0
    }
    return total
}

export function determineRiskProfile(score: number): RiskProfile {
    if (score <= 15) return "Conservative"
    if (score <= 25) return "Moderate"
    if (score <= 38) return "Balanced"
    if (score <= 48) return "Dynamic"
    return "Aggressive"
}
