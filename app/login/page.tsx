// app/login/page.tsx
"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { ModeToggle } from "@/components/ui/mode-toggle"
import { useRouter, useSearchParams } from "next/navigation"
import { readGuestCart, clearGuestCart } from "@/lib/commerce"
import { requestJSON } from "@/lib/sync"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const signupSuccess = searchParams.get("signup") === "1"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError("")
    setSubmitting(true)
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false
      })
      if (res?.error) {
        setError("Invalid email or password")
        return
      }

      const guestCart = readGuestCart()
      if (guestCart.length > 0) {
        await requestJSON(
          "/api/cart",
          {
            items: guestCart.map((item) => ({
              productId: item.productId || item.id,
              name: item.name,
              price: item.price,
              qty: item.qty
            }))
          },
          "PUT",
          {}
        )
        clearGuestCart()
      }
      const meRes = await fetch("/api/me")
      if (!meRes.ok) throw new Error("Unable to load profile")
      const data = await meRes.json().catch(() => ({}))
      const role = data?.user?.role || "user"
      const returnTo = searchParams.get("returnTo")
      const wantsCheckout = searchParams.get("checkout") === "1"
      if (role === "user" && returnTo) {
        router.push(wantsCheckout ? "/customer/cart" : returnTo)
        return
      }
      if (role === "admin") router.push("/financial-engine")
      else if (role === "vendor") router.push("/portal")
      else if (role === "rider") router.push("/rider")
      else if (role === "reseller") router.push("/reseller")
      else if (role === "pro") router.push("/pro_portal")
      else router.push("/customer")
    } catch {
      setError("We could not complete login right now. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-mydark flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Bal Nova</p>
            <h1 className="text-2xl font-black text-mynavy dark:text-white">Welcome Back</h1>
          </div>
          <ModeToggle />
        </div>
        <Link href="/" className="text-xs font-bold text-gray-500 hover:text-mynavy dark:hover:text-white">
          ← Back to Landing
        </Link>
        {signupSuccess ? (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-300">
            Account created. Sign in to continue.
          </div>
        ) : null}
        <p className="text-xs text-gray-500 mb-6">Login to your Bal Nova account.</p>
        <label className="text-xs font-bold text-gray-500">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          className="w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white mb-3"
          required
        />
        <label className="text-xs font-bold text-gray-500">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
          className="w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white mb-4"
          required
        />
        {error ? <div className="text-xs text-red-500 mb-3">{error}</div> : null}
        <button
          disabled={submitting}
          className="w-full bg-mynavy text-white py-3 rounded-xl font-bold disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Logging in..." : "Login"}
        </button>
        {submitting ? <p className="mt-3 text-xs text-gray-500">Checking your account and preparing your dashboard...</p> : null}
        <div className="mt-3 text-right">
          <Link href="/forgot-password" className="text-xs font-semibold text-myamber hover:text-myamber/80">
            Forgot password?
          </Link>
        </div>
        <p className="text-[11px] text-gray-500 mt-3">
          Vendor, rider, reseller, and pro accounts require admin approval before login.
        </p>
        <p className="text-xs text-gray-500 mt-4">
          No account? <Link href="/signup" className="text-myamber font-bold">Sign up</Link>
        </p>
      </form>
    </div>
  )
}

