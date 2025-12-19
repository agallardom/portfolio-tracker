"use client"

import { useState } from "react"
import { QUESTIONS, Question } from "@/lib/risk-engine"
import { saveRiskProfile } from "@/actions/profile-actions"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react"

export function Questionnaire() {
    const [currentBlockIndex, setCurrentBlockIndex] = useState(0)
    const [answers, setAnswers] = useState<Record<string, number>>({})

    // Context State
    const [horizon, setHorizon] = useState("")
    const [goal, setGoal] = useState("")
    const [restrictions, setRestrictions] = useState("")

    const [loading, setLoading] = useState(false)

    const router = useRouter()
    const blocks = ["I", "II", "III", "IV"] as const

    const currentBlock = blocks[currentBlockIndex]
    const blockQuestions = QUESTIONS.filter(q => q.block === currentBlock)

    // Check completion
    const isBlockComplete = currentBlock === "IV"
        ? (horizon !== "" && goal !== "")
        : blockQuestions.every(q => answers[q.id] !== undefined)

    const handleNext = async () => {
        if (currentBlockIndex < blocks.length - 1) {
            setCurrentBlockIndex(prev => prev + 1)
            window.scrollTo(0, 0)
        } else {
            // Submit
            setLoading(true)
            const res = await saveRiskProfile(answers, {
                horizon,
                goal,
                restrictions
            })
            if (res.success) {
                router.push("/?onboarding=completed")
            } else {
                alert("Something went wrong. Please try again.")
                setLoading(false)
            }
        }
    }

    const handleBack = () => {
        if (currentBlockIndex > 0) {
            setCurrentBlockIndex(prev => prev - 1)
        }
    }

    const handleSelect = (questionId: string, points: number) => {
        setAnswers(prev => ({ ...prev, [questionId]: points }))
    }

    const progress = ((currentBlockIndex) / blocks.length) * 100

    return (
        <div className="max-w-3xl mx-auto w-full">
            {/* Progress Bar */}
            <div className="mb-8">
                <div className="flex justify-between text-xs uppercase tracking-wider text-zinc-500 mb-2">
                    <span>Progress</span>
                    <span>Step {currentBlockIndex + 1} / 4</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-teal-500 to-blue-500 transition-all duration-500 ease-out"
                        style={{ width: `${((currentBlockIndex + 1) / 4) * 100}%` }}
                    />
                </div>
            </div>

            <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl p-8 shadow-xl">
                <div className="mb-8">
                    <span className="text-teal-500 font-bold tracking-wider text-sm uppercase block mb-2">
                        Block {currentBlock}
                    </span>
                    <h2 className="text-3xl font-bold text-white">
                        {currentBlock === "I" && "Experience & Knowledge"}
                        {currentBlock === "II" && "Financial Situation"}
                        {currentBlock === "III" && "Risk Tolerance"}
                        {currentBlock === "IV" && "Investment Context"}
                    </h2>
                    <p className="text-zinc-400 mt-2">
                        {currentBlock === "I" && "Help us understand your investment background."}
                        {currentBlock === "II" && "Tell us about your financial stability and goals."}
                        {currentBlock === "III" && "How do you react to market changes?"}
                        {currentBlock === "IV" && "Provide context for the AI Advisor (Horizon, Goals, Restrictions)."}
                    </p>
                </div>

                <div className="space-y-10">
                    {currentBlock === "IV" ? (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Investment Horizon */}
                            <div>
                                <h3 className="text-lg font-medium text-zinc-200 mb-4">1. Investment Horizon</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {["Short Term (< 2Y)", "Medium Term (2-5Y)", "Long Term (> 5Y)"].map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => setHorizon(opt)}
                                            className={`p-4 rounded-xl text-left border transition-all duration-200 ${horizon === opt ? 'bg-teal-500/10 border-teal-500/50 text-teal-100' : 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
                                        >
                                            {opt}
                                            {horizon === opt && <CheckCircle2 className="w-5 h-5 ml-2 inline" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Investment Goal */}
                            <div>
                                <h3 className="text-lg font-medium text-zinc-200 mb-4">2. Primary Goal</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {["Capital Preservation", "Balanced Growth", "Aggressive Growth", "Income / Dividends"].map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => setGoal(opt)}
                                            className={`p-4 rounded-xl text-left border transition-all duration-200 ${goal === opt ? 'bg-teal-500/10 border-teal-500/50 text-teal-100' : 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
                                        >
                                            {opt}
                                            {goal === opt && <CheckCircle2 className="w-5 h-5 ml-2 inline" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Restrictions */}
                            <div>
                                <h3 className="text-lg font-medium text-zinc-200 mb-4">3. Restrictions (Optional)</h3>
                                <textarea
                                    value={restrictions}
                                    onChange={(e) => setRestrictions(e.target.value)}
                                    placeholder="e.g. No Crypto, ESG only, Avoid Banking Sector..."
                                    className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 min-h-[100px]"
                                />
                            </div>
                        </div>
                    ) : (
                        blockQuestions.map((q, idx) => (
                            <div key={q.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                                <h3 className="text-lg font-medium text-zinc-200 mb-4">
                                    {blockQuestions.indexOf(q) + 1}. {q.text}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {q.options.map((opt) => {
                                        const isSelected = answers[q.id] === opt.points
                                        return (
                                            <button
                                                key={opt.label}
                                                onClick={() => handleSelect(q.id, opt.points)}
                                                className={`
                                        relative group p-4 rounded-xl text-left border transition-all duration-200
                                        ${isSelected
                                                        ? 'bg-teal-500/10 border-teal-500/50 shadow-lg shadow-teal-900/20'
                                                        : 'bg-zinc-950/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50'
                                                    }
                                    `}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <span className={`text-sm ${isSelected ? 'text-teal-100' : 'text-zinc-400 group-hover:text-zinc-300'}`}>
                                                        {opt.label}
                                                    </span>
                                                    {isSelected && (
                                                        <CheckCircle2 className="w-5 h-5 text-teal-400" />
                                                    )}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )))}
                </div>

                <div className="mt-12 flex justify-between pt-8 border-t border-zinc-800/50">
                    <button
                        onClick={handleBack}
                        disabled={currentBlockIndex === 0}
                        className={`
                    flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all
                    ${currentBlockIndex === 0
                                ? 'text-zinc-600 cursor-not-allowed'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                            }
                `}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={!isBlockComplete || loading}
                        className={`
                    flex items-center gap-2 px-8 py-3 rounded-xl font-semibold shadow-lg transition-all transform
                    ${!isBlockComplete || loading
                                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white hover:scale-[1.02] shadow-teal-500/20'
                            }
                `}
                    >
                        {loading ? "Processing..." : (currentBlockIndex === blocks.length - 1 ? "Finish Profile" : "Next Step")}
                        {!loading && <ArrowRight className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    )
}
