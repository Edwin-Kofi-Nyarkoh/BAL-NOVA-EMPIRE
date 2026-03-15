// app/financial-cockpit/page.tsx
"use client"

import { useMemo } from "react"
import { AdminShell } from "@/components/dashboard/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { useLedgerQuery, useOrdersQuery } from "@/lib/query"
import { formatCurrency } from "@/lib/utils"

export default function FinancialCockpitPage() {
  const ledgerQuery = useLedgerQuery(200)
  const ordersQuery = useOrdersQuery(true)
  const ledger = ledgerQuery.data || []
  const orders = ordersQuery.data || []
  const status = ledgerQuery.isError || ordersQuery.isError ? "error" : "idle"

  const totals = useMemo(() => {
    return ledger.reduce(
      (acc, entry) => {
        acc[entry.type] = (acc[entry.type] || 0) + entry.amount
        acc.total += entry.amount
        return acc
      },
      { total: 0 } as Record<string, number>
    )
  }, [ledger])

  const pendingOrders = useMemo(() => orders.filter((o) => o.status?.toLowerCase() === "pending"), [orders])
  const deliveredOrders = useMemo(() => orders.filter((o) => o.status?.toLowerCase() === "delivered"), [orders])
  const backlogValue = useMemo(() => pendingOrders.reduce((sum, o) => sum + o.price, 0), [pendingOrders])
  const otifScore = useMemo(() => {
    if (!orders.length) return 0
    return Math.round((deliveredOrders.length / orders.length) * 100)
  }, [orders, deliveredOrders])
  const riskLevel = otifScore >= 90 ? "STABLE" : otifScore >= 70 ? "BUSY" : "RISK"
  const recentLedger = ledger.slice(0, 6)
  const recentOrders = orders.slice(0, 6)

  return (
    <AdminShell title="Financial Cockpit" subtitle="Strategic controls and risk posture">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-gray-900 text-white border border-gray-700 lg:col-span-2 relative overflow-hidden">
          <div className="scanning-line" />
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Strategic Cockpit</h3>
                <p className="text-xs text-gray-400">Live control surface for revenue + risk.</p>
              </div>
              <span className="text-[10px] bg-myamber text-mynavy px-2 py-1 rounded font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 pulse-dot" />
                LIVE
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-white/10 p-4 bg-black/40">
                <p className="text-xs text-gray-400 uppercase">Total Ledger</p>
                <p className="text-lg font-bold">{formatCurrency(totals.total || 0)}</p>
              </div>
              <div className="rounded-xl border border-white/10 p-4 bg-black/40">
                <p className="text-xs text-gray-400 uppercase">Revenue</p>
                <p className="text-lg font-bold text-green-400">{formatCurrency(totals.REVENUE || 0)}</p>
              </div>
              <div className="rounded-xl border border-white/10 p-4 bg-black/40">
                <p className="text-xs text-gray-400 uppercase">Escrow</p>
                <p className="text-lg font-bold text-purple-300">{formatCurrency(totals.ESCROW || 0)}</p>
              </div>
              <div className="rounded-xl border border-white/10 p-4 bg-black/40">
                <p className="text-xs text-gray-400 uppercase">Backlog</p>
                <p className="text-lg font-bold text-orange-300">{formatCurrency(backlogValue)}</p>
              </div>
            </div>

            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
              <div className="text-xs text-red-200 uppercase font-bold mb-1">Operational Risk</div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">
                  OTIF Score: <strong>{otifScore}%</strong>
                </span>
                <span className="text-[10px] font-bold px-2 py-1 rounded bg-white/10">{riskLevel}</span>
              </div>
            </div>

            {status === "error" ? <p className="text-xs text-red-400">Unable to load cockpit data.</p> : null}
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-mydark">
          <CardContent className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-mynavy dark:text-white">Order Pulse</h3>
              <p className="text-xs text-gray-500">Realtime fulfillment status.</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Pending</span>
                <span className="font-bold text-orange-500">{pendingOrders.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Delivered</span>
                <span className="font-bold text-green-600">{deliveredOrders.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Total</span>
                <span className="font-bold text-mynavy dark:text-white">{orders.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="bg-white dark:bg-mydark">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-500 uppercase">Recent Ledger Entries</h3>
              <span className="text-[10px] text-gray-400">{recentLedger.length} shown</span>
            </div>
            {recentLedger.length === 0 ? (
              <p className="text-sm text-gray-500">No ledger activity yet.</p>
            ) : (
              recentLedger.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between text-sm border-b border-gray-200/60 dark:border-white/10 pb-2">
                  <div>
                    <div className="font-semibold">{entry.type}</div>
                    <div className="text-[10px] text-gray-400">{entry.note || "No note"}</div>
                  </div>
                  <div className="font-bold text-mynavy dark:text-white">{formatCurrency(entry.amount)}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-mydark">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-500 uppercase">Latest Orders</h3>
              <span className="text-[10px] text-gray-400">{recentOrders.length} shown</span>
            </div>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-gray-500">No orders yet.</p>
            ) : (
              recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between text-sm border-b border-gray-200/60 dark:border-white/10 pb-2">
                  <div>
                    <div className="font-semibold">{order.item}</div>
                    <span
                      className={`inline-flex text-[10px] font-bold px-2 py-1 rounded-full ${
                        order.status === "Paid" || order.status === "Delivered"
                          ? "bg-emerald-500/15 text-emerald-600"
                          : "bg-amber-500/15 text-amber-600"
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <div className="font-bold text-mynavy dark:text-white">{formatCurrency(order.price)}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  )
}
