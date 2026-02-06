"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

export default function PaymentCallbackPage() {
  const searchParams = useSearchParams()
  const txRef = searchParams.get("reference") || searchParams.get("tx_ref") || ""
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("Verifying payment...")

  useEffect(() => {
    async function verify() {
      if (!txRef) {
        setStatus("error")
        setMessage("Missing transaction reference.")
        return
      }
      try {
        const res = await fetch(`/api/payments/verify?reference=${encodeURIComponent(txRef)}`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data?.result?.ok === false) {
          throw new Error(data?.error || "Payment verification failed.")
        }
        setStatus("success")
        setMessage("Payment confirmed. Your order is being processed.")
      } catch (err) {
        setStatus("error")
        setMessage(err instanceof Error ? err.message : "Payment verification failed.")
      }
    }
    verify()
  }, [txRef])

  return (
    <div className="min-h-screen bg-white dark:bg-mydark flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 text-center space-y-4">
        <h1 className="text-2xl font-black text-mynavy dark:text-white">Payment Status</h1>
        <p className="text-sm text-gray-500">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/storefront" className="text-xs font-bold px-3 py-2 rounded-full border border-myamber/30 text-myamber hover:bg-myamber/10">
            Back to Storefront
          </Link>
          <Link href="/customer" className="text-xs font-bold px-3 py-2 rounded-full border border-blue-500/30 text-blue-600 hover:bg-blue-500/10">
            Go to Orders
          </Link>
        </div>
        {status === "loading" ? (
          <div className="text-xs text-gray-400">Processing...</div>
        ) : null}
      </div>
    </div>
  )
}
