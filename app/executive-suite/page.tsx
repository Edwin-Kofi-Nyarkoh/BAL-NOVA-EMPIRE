// app/executive-suite/page.tsx
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AdminShell } from "@/components/dashboard/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Users } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

type Analytics = {
  totals: {
    ordersCount: number
    revenue: number
  }
}

type OrderRow = {
  id: string
  item: string
  status: string
  price: number
  createdAt: string
}

export default function ExecutiveSuitePage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [message, setMessage] = useState("")
  const [nextRetryIn, setNextRetryIn] = useState(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true
    async function load(attempt = 0) {
      try {
        setStatus("loading")
        setMessage("")
        setNextRetryIn(0)
        const [analyticsRes, ordersRes] = await Promise.all([
          fetch("/api/analytics"),
          fetch("/api/orders?all=1")
        ])
        const analyticsJson = analyticsRes.ok ? await analyticsRes.json() : null
        const ordersJson = ordersRes.ok ? await ordersRes.json() : null
        if (!active) return
        setAnalytics(analyticsJson)
        setOrders(Array.isArray(ordersJson?.orders) ? ordersJson.orders : [])
        setStatus("idle")
      } catch {
        if (!active) return
        setAnalytics(null)
        setOrders([])
        setStatus("error")
        setMessage("Unable to load executive metrics.")
        if (attempt < 2) {
          const delay = attempt === 0 ? 2500 : 6000
          setNextRetryIn(delay / 1000)
          retryTimer.current = setTimeout(() => {
            void load(attempt + 1)
          }, delay)
        }
      }
    }
    load()
    return () => {
      active = false
      if (retryTimer.current) clearTimeout(retryTimer.current)
    }
  }, [])

  const deliveredCount = useMemo(
    () => orders.filter((o) => o.status?.toLowerCase() === "delivered").length,
    [orders]
  )
  const pendingCount = useMemo(
    () => orders.filter((o) => o.status?.toLowerCase() === "pending").length,
    [orders]
  )
  const fulfillmentRate = useMemo(() => {
    if (!orders.length) return 0
    return Math.round((deliveredCount / orders.length) * 100)
  }, [orders, deliveredCount])

  return (
    <AdminShell title="Financial Engine (v3.0 Global)" subtitle="Global Logistics OS">
      <div className="space-y-6">
        {status === "error" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
            <div className="font-bold">Metrics unavailable</div>
            <div className="text-xs opacity-80">
              {message} {nextRetryIn > 0 ? `Retrying in ${nextRetryIn}s…` : ""}
            </div>
          </div>
        ) : null}
        <Card className="bg-white text-gray-900 dark:bg-slate-900/70 dark:text-white rounded-xl shadow-sm border border-gray-200/70 dark:border-white/10">
          <CardContent className="p-6 flex items-start gap-3">
            <div className="mt-1 h-10 w-10 rounded-full bg-myamber/10 flex items-center justify-center">
              <Users className="text-myamber h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-myamber">Global Executive Overview</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Business Health & Strategic KPI Monitoring.</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-white text-gray-900 dark:bg-slate-900/60 dark:text-white rounded-xl border border-gray-200/70 dark:border-white/10">
            <CardContent className="p-6 space-y-3">
              <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Order Fulfillment</div>
              <div className="text-3xl font-black">{fulfillmentRate}%</div>
              <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
                <span>Delivered: {deliveredCount}</span>
                <Badge className="bg-gray-100 text-gray-700 border border-gray-200 dark:bg-white/10 dark:text-gray-200 dark:border-white/10">Live</Badge>
              </div>
              <Progress value={fulfillmentRate} className="h-2 bg-gray-200/80 dark:bg-white/10" />
            </CardContent>
          </Card>

          <Card className="bg-white text-gray-900 dark:bg-slate-900/60 dark:text-white rounded-xl border border-blue-500/40">
            <CardContent className="p-6 space-y-3">
              <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Active Orders</div>
              <div className="text-3xl font-black">{pendingCount}</div>
              <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
                <span>Total: {analytics?.totals.ordersCount ?? 0}</span>
                <Badge className="bg-gray-100 text-gray-700 border border-gray-200 dark:bg-white/10 dark:text-gray-200 dark:border-white/10">Live</Badge>
              </div>
              <Progress value={Math.min(100, orders.length ? Math.round((pendingCount / orders.length) * 100) : 0)} className="h-2 bg-gray-200/80 dark:bg-white/10" />
            </CardContent>
          </Card>

          <Card className="bg-white text-gray-900 dark:bg-slate-900/60 dark:text-white rounded-xl border border-green-500/40">
            <CardContent className="p-6 space-y-3">
              <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Revenue (Total)</div>
              <div className="text-3xl font-black">{formatCurrency(analytics?.totals.revenue ?? 0)}</div>
              <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
                <span>Orders: {analytics?.totals.ordersCount ?? 0}</span>
                <Badge className="bg-gray-100 text-gray-700 border border-gray-200 dark:bg-white/10 dark:text-gray-200 dark:border-white/10">Live</Badge>
              </div>
              <Progress value={Math.min(100, analytics?.totals.ordersCount ? 60 : 0)} className="h-2 bg-gray-200/80 dark:bg-white/10" />
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white text-gray-900 dark:bg-slate-900/60 dark:text-white rounded-xl border border-gray-200/70 dark:border-white/10 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-5 border-b border-gray-200/70 dark:border-white/10">
              <div>
                <h3 className="text-lg font-bold">Order Performance Matrix</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Latest operational orders.</p>
              </div>
              <Badge className="bg-blue-600 text-white">Live Scorecard</Badge>
            </div>

            <div className="grid grid-cols-5 text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 px-5 py-3">
              <div>Order</div>
              <div>Status</div>
              <div>Amount</div>
              <div>Created</div>
              <div>Signal</div>
            </div>

            {orders.length === 0 ? (
              <div className="px-5 py-6 text-sm text-gray-500">No orders yet.</div>
            ) : orders.slice(0, 6).map((row) => (
              <div key={row.id} className="grid grid-cols-5 px-5 py-3 border-t border-gray-200/70 dark:border-white/5 text-xs">
                <div className="font-semibold">{row.item}</div>
                <div className="text-gray-600 dark:text-gray-300">{row.status}</div>
                <div className="text-myamber">{formatCurrency(row.price)}</div>
                <div className="text-gray-500">{new Date(row.createdAt).toLocaleDateString()}</div>
                <div className={row.status.toLowerCase() === "delivered" ? "text-green-500" : "text-myamber"}>
                  {row.status.toUpperCase()}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  )
}
