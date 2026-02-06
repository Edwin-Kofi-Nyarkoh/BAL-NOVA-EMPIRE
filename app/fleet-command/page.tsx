// app/fleet-command/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { AdminShell } from "@/components/dashboard/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

type OrderRow = {
  id: string
  item: string
  status: string
  price: number
  createdAt: string
  origin?: string | null
}

export default function FleetCommandPage() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [logs, setLogs] = useState<{ action: string; createdAt: string }[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      setStatus("loading")
      try {
        const [ordersRes, logsRes] = await Promise.all([
          fetch("/api/orders?all=1"),
          fetch("/api/audit?take=200")
        ])
        const data = await ordersRes.json().catch(() => ({}))
        const logsJson = logsRes.ok ? await logsRes.json().catch(() => ({})) : {}
        if (!active) return
        setOrders(Array.isArray(data.orders) ? data.orders : [])
        setLogs(Array.isArray(logsJson.logs) ? logsJson.logs : [])
        setStatus("idle")
      } catch {
        if (!active) return
        setStatus("error")
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    setNow(Date.now())
  }, [])

  const pending = useMemo(() => orders.filter((o) => o.status?.toLowerCase() === "pending"), [orders])
  const delivered = useMemo(() => orders.filter((o) => o.status?.toLowerCase() === "delivered"), [orders])
  const inProgress = useMemo(
    () => orders.filter((o) => !["pending", "delivered"].includes(o.status?.toLowerCase() || "")),
    [orders]
  )
  const latest = orders.slice(0, 8)
  const lastHour = useMemo(() => {
    if (!now) return []
    const cutoff = now - 60 * 60 * 1000
    return orders.filter((o) => new Date(o.createdAt).getTime() >= cutoff)
  }, [orders, now])
  const rpm = lastHour.reduce((sum, o) => sum + o.price, 0)
  const pph = lastHour.length
  const otifScore = orders.length ? Math.round((delivered.length / orders.length) * 100) : 0
  const incidents = logs.filter((l) => l.action?.toLowerCase().includes("error") || l.action?.toLowerCase().includes("failed")).length

  return (
    <AdminShell title="Fleet Command" subtitle="Vehicles, riders, and capacity">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900 text-white border border-gray-700 relative overflow-hidden">
          <div className="scanning-line" />
          <CardContent className="p-4 text-center">
            <div className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Fleet RPM (Rev/Hr)</div>
            <div className="text-3xl font-black">{formatCurrency(rpm)}</div>
            <div className="text-[10px] text-green-400 mt-1">LIVE</div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <CardContent className="p-0">
            <div className="text-xs text-gray-500 uppercase">OTIF Score</div>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-bold dark:text-white">{otifScore}%</div>
              <div className="text-xs text-green-500 font-bold bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">SLA</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <CardContent className="p-0">
            <div className="text-xs text-gray-500 uppercase">PPH (Velocity)</div>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-bold text-myamber">{pph}</div>
              <div className="text-[10px] text-gray-400">Packages / Hr</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-red-500">
          <CardContent className="p-0">
            <div className="text-xs text-gray-500 uppercase">Active Incidents</div>
            <div className="text-xl font-bold text-red-500">{incidents}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white dark:bg-gray-800 mt-6 relative overflow-hidden">
        <div className="scanning-line opacity-40" />
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-500 uppercase">Active Roster</h3>
            <span className="text-xs bg-mynavy text-white px-2 py-1 rounded">Live Sync</span>
          </div>
          {status === "error" ? (
            <p className="text-sm text-red-500">Unable to load orders.</p>
          ) : latest.length === 0 ? (
            <p className="text-sm text-gray-500">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="p-3">Order</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Load</th>
                    <th className="p-3 text-right">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {latest.map((order) => (
                    <tr key={order.id}>
                      <td className="p-3 font-semibold">{order.item}</td>
                      <td className="p-3 text-xs">
                        <span
                          className={`inline-flex text-[10px] font-bold px-2 py-1 rounded-full ${
                            order.status === "Paid" || order.status === "Delivered"
                              ? "bg-emerald-500/15 text-emerald-600"
                              : "bg-amber-500/15 text-amber-600"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-gray-500">{formatCurrency(order.price)}</td>
                      <td className="p-3 text-xs text-gray-500 text-right">{order.origin || "core"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  )
}
