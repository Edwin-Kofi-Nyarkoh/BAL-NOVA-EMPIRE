"use client"

import { useMemo } from "react"
import { AdminShell } from "@/components/dashboard/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { MetricCard } from "@/components/ui/metric-card"
import { LineChart } from "@/components/ui/line-chart"
import { useAnalyticsQuery, useAnalyticsTrendsQuery } from "@/lib/query"

export default function FinancialStatsPage() {
  const analyticsQuery = useAnalyticsQuery()
  const trendsQuery = useAnalyticsTrendsQuery()
  const data = analyticsQuery.data || null
  const trends = trendsQuery.data || []
  const status =
    analyticsQuery.isError || trendsQuery.isError
      ? "error"
      : analyticsQuery.isLoading || trendsQuery.isLoading
        ? "loading"
        : "idle"
  const message = status === "error" ? "Unable to load analytics." : ""
  const lastUpdated = analyticsQuery.dataUpdatedAt
    ? new Date(analyticsQuery.dataUpdatedAt).toLocaleTimeString()
    : ""

  const bars = useMemo(() => {
    if (!data) return []
    return [
      { label: "Orders", value: data.last24h.orders, color: "bg-blue-500" },
      { label: "Chats", value: data.last24h.chats, color: "bg-purple-500" },
      { label: "New Users", value: data.last24h.newUsers, color: "bg-green-500" }
    ]
  }, [data])

  const maxBarValue = useMemo(() => {
    if (!bars.length) return 1
    return Math.max(...bars.map((b) => b.value), 1)
  }, [bars])

  const refreshAll = () => {
    void analyticsQuery.refetch()
    void trendsQuery.refetch()
  }

  return (
    <AdminShell title="Financial Stats" subtitle="Performance metrics and trends">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard
            label="Revenue (Total)"
            value={data ? `GHS ${data.totals.revenue.toFixed(2)}` : "--"}
            caption="Lifetime order value"
            tone="warning"
          />
          <MetricCard
            label="Orders (Total)"
            value={data ? data.totals.ordersCount : "--"}
            caption="All orders captured"
          />
          <MetricCard
            label="Inventory (Total)"
            value={data ? data.totals.inventoryCount : "--"}
            caption="Active SKUs"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-white dark:bg-mydark lg:col-span-2">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-mynavy dark:text-white">Operations Pulse (24h)</h3>
                  <p className="text-xs text-gray-500">Orders, chats, and new users.</p>
                </div>
                <button
                  onClick={refreshAll}
                  className="text-xs font-bold px-3 py-2 rounded-full border border-myamber/40 text-myamber hover:bg-myamber/10 transition-colors"
                >
                  Refresh
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                {lastUpdated ? <span>Last updated: {lastUpdated}</span> : null}
                {status === "error" ? (
                  <button
                    onClick={refreshAll}
                    className="text-[11px] font-semibold text-blue-600 hover:underline"
                  >
                    Retry now
                  </button>
                ) : null}
              </div>

              {data ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-4">
                      <p className="text-xs text-gray-500">Orders (24h)</p>
                      <p className="text-xl font-bold text-mynavy dark:text-white">{data.last24h.orders}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-4">
                      <p className="text-xs text-gray-500">Chats (24h)</p>
                      <p className="text-xl font-bold text-mynavy dark:text-white">{data.last24h.chats}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-4">
                      <p className="text-xs text-gray-500">New Users (24h)</p>
                      <p className="text-xl font-bold text-mynavy dark:text-white">{data.last24h.newUsers}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-4">
                    <p className="text-xs text-gray-500 mb-3">24h Activity Mix</p>
                    <div className="space-y-3">
                      {bars.map((bar) => (
                        <div key={bar.label}>
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>{bar.label}</span>
                            <span className="font-semibold text-gray-700 dark:text-gray-200">{bar.value}</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-200/70 dark:bg-white/10 overflow-hidden">
                            <div
                              className={`h-full ${bar.color}`}
                              style={{ width: `${(bar.value / maxBarValue) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : status === "loading" ? (
                <p className="text-sm text-gray-500">Loading analytics...</p>
              ) : (
                <p className="text-sm text-gray-500">{message || "No analytics yet."}</p>
              )}
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-mydark">
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-mynavy dark:text-white">User Base</h3>
                <p className="text-xs text-gray-500">Active accounts and admins.</p>
              </div>
              <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-4">
                <p className="text-xs text-gray-500">Total Users</p>
                <p className="text-xl font-bold text-mynavy dark:text-white">{data ? data.totals.usersCount : "--"}</p>
              </div>
              <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-4">
                <p className="text-xs text-gray-500">Admins</p>
                <p className="text-xl font-bold text-mynavy dark:text-white">{data ? data.totals.adminsCount : "--"}</p>
              </div>
              <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-4">
                <p className="text-xs text-gray-500">Chat Messages</p>
                <p className="text-xl font-bold text-mynavy dark:text-white">{data ? data.totals.chatsCount : "--"}</p>
              </div>
              <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-4">
                <p className="text-xs text-gray-500">Low Stock Items</p>
                <p className="text-xl font-bold text-mynavy dark:text-white">
                  {data ? data.totals.lowInventoryCount : "--"}
                </p>
              </div>
              {status === "error" ? (
                <p className="text-xs text-red-500">{message || "Unable to load analytics."}</p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white dark:bg-mydark">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-mynavy dark:text-white">Revenue Trend (14 Days)</h3>
                <p className="text-xs text-gray-500">Orders and revenue trajectory.</p>
              </div>
              <button
                onClick={refreshAll}
                className="text-xs font-bold px-3 py-2 rounded-full border border-myamber/40 text-myamber hover:bg-myamber/10 transition-colors"
              >
                Refresh
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-4">
                <p className="text-xs text-gray-500 mb-3">Revenue (GHS)</p>
                <LineChart
                  data={trends.map((t) => ({ label: t.date, value: t.revenue }))}
                  stroke="#f59e0b"
                />
              </div>
              <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-4">
                <p className="text-xs text-gray-500 mb-3">Orders</p>
                <LineChart
                  data={trends.map((t) => ({ label: t.date, value: t.orders }))}
                  stroke="#2563eb"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  )
}
