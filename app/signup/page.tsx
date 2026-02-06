// app/signup/page.tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ModeToggle } from "@/components/ui/mode-toggle"

export default function SignupPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("user")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    const requestedRole = searchParams.get("role")
    if (!requestedRole) return
    const allowed = new Set(["user", "vendor", "rider", "reseller", "pro"])
    if (allowed.has(requestedRole)) {
      setRole(requestedRole)
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setMessage("")
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role })
    })
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      const approvalStatus = data?.approvalStatus
      const msg = data?.message || "Account created."
      setPending(approvalStatus === "pending")
      setMessage(msg)
      setName("")
      setEmail("")
      setPassword("")
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || "Signup failed")
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-mydark flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Bal Nova</p>
            <h1 className="text-2xl font-black text-mynavy dark:text-white">Create Account</h1>
          </div>
          <ModeToggle />
        </div>
        <Link href="/" className="text-xs font-bold text-gray-500 hover:text-mynavy dark:hover:text-white">
          ← Back to Landing
        </Link>
        <p className="text-xs text-gray-500 mb-6">Sign up to access Bal Nova portals.</p>
        <label className="text-xs font-bold text-gray-500">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white mb-3"
          required
        />
        <label className="text-xs font-bold text-gray-500">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white mb-3"
          required
        />
        <label className="text-xs font-bold text-gray-500">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white mb-3"
          required
        />
        <label className="text-xs font-bold text-gray-500">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white mb-4"
        >
          <option value="user">Customer</option>
          <option value="vendor">Vendor</option>
          <option value="rider">Rider</option>
          <option value="reseller">Reseller</option>
          <option value="pro">Pro</option>
        </select>
        {error ? <div className="text-xs text-red-500 mb-3">{error}</div> : null}
        {message ? (
          <div className={`text-xs mb-3 ${pending ? "text-myamber" : "text-green-500"}`}>{message}</div>
        ) : null}
        {pending ? (
          <div className="text-[11px] text-gray-500 mb-3">
            Partner accounts require admin approval before you can sign in.
          </div>
        ) : null}
        <button className="w-full bg-mynavy text-white py-3 rounded-xl font-bold">Create Account</button>
        <p className="text-xs text-gray-500 mt-4">
          Already have an account? <Link href="/login" className="text-myamber font-bold">Login</Link>
        </p>
      </form>
    </div>
  )
}

