"use client"

import { useState } from "react"
import Link from "next/link"
import { ModeToggle } from "@/components/ui/mode-toggle"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setMessage("")
    setBusy(true)
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Request failed")
      }
      setMessage("If an account exists, a reset link has been sent.")
      setEmail("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-mydark flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Bal Nova</p>
            <h1 className="text-2xl font-black text-mynavy dark:text-white">Reset Password</h1>
          </div>
          <ModeToggle />
        </div>
        <Link href="/login" className="text-xs font-bold text-gray-500 hover:text-mynavy dark:hover:text-white">
          ← Back to Login
        </Link>
        <p className="text-xs text-gray-500 mb-6">
          Enter your email to receive a reset link.
        </p>
        <label className="text-xs font-bold text-gray-500">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white mb-4"
          required
        />
        {error ? <div className="text-xs text-red-500 mb-3">{error}</div> : null}
        {message ? <div className="text-xs text-green-500 mb-3">{message}</div> : null}
        <button
          className="w-full bg-mynavy text-white py-3 rounded-xl font-bold disabled:opacity-60"
          disabled={busy}
        >
          {busy ? "Sending..." : "Send Reset Link"}
        </button>
      </form>
    </div>
  )
}
