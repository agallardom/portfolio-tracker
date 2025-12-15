"use client"

import { useState, useRef, useEffect } from "react"
import { LogOut, Trash2, User, ChevronDown, UserCircle } from "lucide-react"
import { deleteMyAccount, logOut } from "@/actions/account-actions"

interface UserMenuProps {
    email?: string | null
}

export function UserMenu({ email }: UserMenuProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleDelete = async () => {
        setIsDeleting(true)
        await deleteMyAccount()
    }

    return (
        <div className="relative ml-4" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
            >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center text-white shadow-lg">
                    <UserCircle className="w-5 h-5" />
                </div>
                {email && (
                    <span className="text-sm font-medium text-zinc-300 hidden md:block max-w-[100px] truncate">
                        {email.split('@')[0]}
                    </span>
                )}
                <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                    <div className="px-3 py-2 border-b border-white/5 mb-2">
                        <p className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Signed in as</p>
                        <p className="text-sm text-zinc-200 truncate">{email}</p>
                    </div>

                    <button
                        onClick={() => logOut()}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left"
                    >
                        <LogOut className="w-4 h-4" />
                        Log Out
                    </button>

                    <button
                        onClick={() => {
                            setIsOpen(false)
                            setShowDeleteConfirm(true)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors text-left"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete Account
                    </button>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-md shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-white mb-2">Delete Account?</h3>
                        <p className="text-zinc-400 mb-6">
                            This action is permanent. All your portfolios, transactions, and risk profile data will be erased immediately.
                        </p>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isDeleting}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors flex items-center gap-2"
                            >
                                {isDeleting ? "Deleting..." : "Yes, Delete Everything"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
