"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AdminShell } from "@/components/dashboard/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

type Payment = {
  id: string
  txRef: string
  amount: number
  currency: string
  status: string
  provider: string
  channel: string
  createdAt: string
  completedAt?: string | null
  user?: { id: string; name: string | null; email: string; role: string }
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [message, setMessage] = useState("")
  const [filter, setFilter] = useState("all")
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [nextRetryIn, setNextRetryIn] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<string>("")
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    void loadPayments()
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current)
    }
  }, [])

  async function loadPayments(attempt = 0) {
    setStatus("loading")
    setMessage("")
    setNextRetryIn(0)
    try {
      const res = await fetch("/api/payments")
      if (!res.ok) throw new Error("Unable to load payments")
      const data = await res.json().catch(() => ({}))
      setPayments(Array.isArray(data.payments) ? data.payments : [])
      setStatus("idle")
      setRetryCount(0)
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      setStatus("error")
      setMessage(err instanceof Error ? err.message : "Unable to load payments")
      if (attempt < 2) {
        const delay = attempt === 0 ? 2000 : 5000
        setRetryCount(attempt + 1)
        setNextRetryIn(delay / 1000)
        retryTimer.current = setTimeout(() => {
          void loadPayments(attempt + 1)
        }, delay)
      }
    }
  }

  const filtered = useMemo(() => {
    if (filter === "all") return payments
    return payments.filter((p) => p.status === filter)
  }, [payments, filter])

  async function resendReceipt(id: string) {
    setSendingId(id)
    try {
      const res = await fetch(`/api/payments/${id}/receipt`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to send receipt")
    } finally {
      setSendingId(null)
    }
  }

  return (
    <AdminShell title="Payments" subtitle="Paystack transactions and order settlements">
      <Card className="bg-white dark:bg-mydark">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-mynavy dark:text-white">Payment Activity</h3>
              <p className="text-xs text-gray-500">Review pending and successful transactions.</p>
            </div>
            <button
              onClick={() => loadPayments(0)}
              className="text-xs font-bold px-3 py-2 rounded-full border border-myamber/40 text-myamber hover:bg-myamber/10 transition-colors"
            >
              Refresh
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
            {lastUpdated ? <span>Last updated: {lastUpdated}</span> : null}
            {nextRetryIn > 0 ? <span>Retrying in {nextRetryIn}s…</span> : null}
            {status === "error" ? (
              <button
                onClick={() => loadPayments(0)}
                className="text-[11px] font-semibold text-blue-600 hover:underline"
              >
                Retry now
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {["all", "pending", "successful", "failed", "mismatch"].map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                  filter === item
                    ? "border-myamber text-myamber bg-myamber/10"
                    : "border-gray-200/60 dark:border-white/10 text-gray-500 hover:bg-gray-100/50 dark:hover:bg-white/5"
                }`}
              >
                {item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>

          {status === "loading" ? (
            <p className="text-sm text-gray-500">Loading payments...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500">No payments found.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{p.txRef}</p>
                      <p className="text-xs text-gray-500">
                        {p.user?.email || "Unknown user"} · {p.channel} · {p.provider}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-myamber">
                        {formatCurrency(p.amount)} {p.currency}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                          p.status === "successful"
                            ? "bg-emerald-500/15 text-emerald-600"
                            : p.status === "pending"
                              ? "bg-amber-500/15 text-amber-600"
                              : "bg-red-500/15 text-red-600"
                        }`}
                      >
                        {p.status}
                      </span>
                      {p.status === "successful" ? (
                        <button
                          onClick={() => resendReceipt(p.id)}
                          className="text-[10px] font-bold px-2 py-1 rounded-full border border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                          disabled={sendingId === p.id}
                        >
                          {sendingId === p.id ? "Sending..." : "Resend Receipt"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-gray-400">
                    Created {new Date(p.createdAt).toLocaleString()}
                    {p.completedAt ? ` · Completed ${new Date(p.completedAt).toLocaleString()}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}

          {(status === "error" || message) && (
            <p className="text-xs text-red-500">{message || "Unable to load payments."}</p>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  )
}
