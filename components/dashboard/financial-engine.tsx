// components/dashboard/FinancialEngine.tsx
"use client"

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Wallet, Landmark, ShieldCheck, Filter, TrendingUp } from "lucide-react"
import { StatCard } from "@/components/dashboard/stat-card"
import { cn, formatCurrency } from "@/lib/utils"
import { getJSON } from "@/lib/sync"

export function FinancialEngine() {
  // Logic from admin_portal.html safeLoad()
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all">("30d")
  const [debtDraft, setDebtDraft] = useState({ totalDebt: "", debtPaid: "" })
  const [trend, setTrend] = useState<{ date: string; revenue: number }[]>([])
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    escrow: 0,
    taxVault: 0,
    netRevenue: 0,
    logisticsRevenue: 0,
    commissionsRevenue: 0,
    debtPaid: 0,
    totalDebt: 0
  })

  useEffect(() => {
    void (async () => {
      const debt = await getJSON<{ totalDebt: number; debtPaid: number }>("/api/finance/debt", {
        totalDebt: 0,
        debtPaid: 0
      })
      const data = await getJSON<{
        totalRevenue: number
        escrow: number
        taxVault: number
        netRevenue: number
        logisticsRevenue: number
        commissionsRevenue: number
        debtPaid: number
        totalDebt: number
      }>(`/api/financial-metrics?range=${range}`, {
        totalRevenue: 0,
        escrow: 0,
        taxVault: 0,
        netRevenue: 0,
        logisticsRevenue: 0,
        commissionsRevenue: 0,
        debtPaid: 0,
        totalDebt: 0
      })
      setMetrics((prev) => ({
        ...prev,
        ...data
      }))
      setDebtDraft({
        totalDebt: String(debt.totalDebt ?? data.totalDebt ?? 0),
        debtPaid: String(debt.debtPaid ?? data.debtPaid ?? 0)
      })
    })()
  }, [range])

  useEffect(() => {
    let active = true
    async function loadTrend() {
      const data = await getJSON<{ series?: { date: string; revenue: number }[] }>(`/api/analytics/trends?range=${range}`, {})
      if (!active) return
      setTrend(Array.isArray(data.series) ? data.series : [])
    }
    loadTrend()
    return () => {
      active = false
    }
  }, [range])

  const chartPoints = useMemo(() => {
    if (!trend.length) return ""
    const values = trend.map((t) => t.revenue)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || 1
    return trend
      .map((t, i) => {
        const x = (i / Math.max(1, trend.length - 1)) * 100
        const y = 40 - ((t.revenue - min) / span) * 32 - 4
        return `${x},${y}`
      })
      .join(" ")
  }, [trend])

  const chartDots = useMemo(() => {
    if (!trend.length) return []
    const values = trend.map((t) => t.revenue)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || 1
    return trend.map((t, i) => {
      const x = (i / Math.max(1, trend.length - 1)) * 100
      const y = 40 - ((t.revenue - min) / span) * 32 - 4
      return { x, y, date: t.date, revenue: t.revenue }
    })
  }, [trend])

  const trendLabel = useMemo(() => {
    const base =
      range === "7d" ? "Revenue Trend (7 Days)" :
      range === "30d" ? "Revenue Trend (30 Days)" :
      range === "90d" ? "Revenue Trend (90 Days)" :
      "Revenue Trend (All Time)"
    if (!trend.length) return base
    const start = trend[0]?.date
    const end = trend[trend.length - 1]?.date
    return start && end ? `${base} · ${start} → ${end}` : base
  }, [range, trend])

  async function saveDebtProfile() {
    const totalDebt = Number(debtDraft.totalDebt || 0)
    const debtPaid = Number(debtDraft.debtPaid || 0)
    await fetch("/api/finance/debt", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalDebt, debtPaid })
    })
    setMetrics((prev) => ({
      ...prev,
      totalDebt,
      debtPaid
    }))
  }

  return (
    <div className="space-y-6">
      {/* Top Metric Row - Replicating your col-span grid */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "7d", label: "7D" },
          { key: "30d", label: "30D" },
          { key: "90d", label: "90D" },
          { key: "all", label: "All" }
        ].map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key as typeof range)}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-full border transition",
              range === r.key
                ? "bg-myamber text-mynavy border-myamber"
                : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-300"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard 
          label="Realized Revenue (Liquid)" 
          value={metrics.totalRevenue} 
          accentClassName="border-l-blue-400"
          className="col-span-2 sm:col-span-2"
          valueClassName="text-3xl"
          subLabel="Delivery Fees + Vested Sales"
        />
        <StatCard 
          label="Escrow (5-Day)" 
          value={metrics.escrow} 
          accentClassName="border-l-purple-500 bg-purple-50 dark:bg-purple-900/20"
          labelClassName="text-purple-800 dark:text-purple-300"
          valueClassName="text-purple-600 dark:text-purple-400"
          subLabel="Pending Clearance"
          subLabelClassName="text-purple-500"
          icon={<Wallet className="text-purple-500" size={14} />}
        />
        <StatCard 
          label="GRA Tax Vault" 
          value={metrics.taxVault} 
          accentClassName="border-l-red-500 bg-red-50 dark:bg-red-900/20"
          labelClassName="text-red-800 dark:text-red-300"
          valueClassName="text-red-600 dark:text-red-400"
          subLabel="18% VAT/Levies"
          subLabelClassName="text-red-500"
          icon={<Landmark className="text-myred" size={14} />}
        />
        <StatCard 
          label="Logistics (Gross)" 
          value={metrics.logisticsRevenue} 
          accentClassName="border-l-mynavy"
          className="col-span-2 sm:col-span-1"
          valueClassName="text-xl"
          subLabel="Immediate Access"
        />
        <StatCard 
          label="Commissions" 
          value={metrics.commissionsRevenue} 
          accentClassName="border-l-myamber"
          valueClassName="text-xl"
          subLabel="Subject to 5-Day Hold"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-0 shadow-sm border border-gray-100 dark:border-gray-700">
          <CardContent className="p-6">
            <h3 className="font-bold text-sm text-gray-500 uppercase mb-4">{trendLabel}</h3>
            <div className="relative h-64 w-full">
              {trend.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <TrendingUp size={48} className="mx-auto mb-2 opacity-20" />
                    <p>No revenue data yet.</p>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  <svg viewBox="0 0 100 40" className="w-full h-full">
                    <defs>
                      <linearGradient id="revFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#FFBF00" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#FFBF00" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <polyline
                      fill="none"
                      stroke="#FFBF00"
                      strokeWidth="1.8"
                      points={chartPoints}
                    />
                    <polygon
                      fill="url(#revFill)"
                      points={`${chartPoints} 100,40 0,40`}
                    />
                    {chartDots.map((dot) => (
                      <circle key={dot.date} cx={dot.x} cy={dot.y} r="1.5" fill="#FFBF00">
                        <title>{`${dot.date}: GHS ${dot.revenue.toFixed(2)}`}</title>
                      </circle>
                    ))}
                  </svg>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-2">
                    <span>{trend[0]?.date}</span>
                    <span>{trend[Math.floor(trend.length / 2)]?.date}</span>
                    <span>{trend[trend.length - 1]?.date}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 bg-gradient-to-br from-gray-900 to-black text-white border-gray-700 relative overflow-hidden">
          <CardContent className="p-6">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <ShieldCheck size={72} />
            </div>
            <h3 className="font-bold text-lg text-myamber flex items-center gap-2 mb-1">
              <ShieldCheck size={20} /> Tax-Safe Engine
            </h3>
            <p className="text-xs text-gray-400 mb-6">GRA Compliant Distribution Protocol</p>

            <div className="mb-4">
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>Debt Repaid: GHS {formatCurrency(metrics.debtPaid)}</span>
                <span className="text-gray-500">Total: GHS {formatCurrency(metrics.totalDebt)}</span>
              </div>
              <Progress
                value={metrics.totalDebt > 0 ? (metrics.debtPaid / metrics.totalDebt) * 100 : 0}
                className="h-2 bg-gray-800"
              />
            </div>

            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <label className="text-gray-400 w-20">Total</label>
                <input
                  value={debtDraft.totalDebt}
                  onChange={(e) => setDebtDraft((prev) => ({ ...prev, totalDebt: e.target.value }))}
                  className="flex-1 rounded-md bg-white/10 border border-white/10 px-2 py-1 text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-gray-400 w-20">Repaid</label>
                <input
                  value={debtDraft.debtPaid}
                  onChange={(e) => setDebtDraft((prev) => ({ ...prev, debtPaid: e.target.value }))}
                  className="flex-1 rounded-md bg-white/10 border border-white/10 px-2 py-1 text-xs"
                />
              </div>
              <button
                onClick={saveDebtProfile}
                className="w-full mt-2 bg-myamber text-mynavy text-xs font-bold py-2 rounded-lg"
              >
                Save Debt Profile
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs bg-white/5 p-4 rounded-lg border border-white/10">
              <div className="flex justify-between text-myred font-bold uppercase text-[10px]">
                <span>0. GRA Checkpoint</span>
                <span>(Pass-Through)</span>
              </div>
              <div className="flex justify-between text-myred">
                <span>VAT/Levies (18%):</span>
                <span>- GHS {formatCurrency(metrics.taxVault)}</span>
              </div>
              <div className="border-t border-white/10 pt-2 flex justify-between font-bold">
                <span className="text-gray-400">Net Revenue:</span>
                <span className="text-white">GHS {formatCurrency(metrics.netRevenue)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-slate-900/70 text-white rounded-xl shadow-sm border border-white/10">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Landmark size={16} className="text-myamber" />
                  Accountant Export Module
                </h3>
                <p className="text-xs text-gray-400">One-click compliance. GRA/SSNIT ready reports.</p>
              </div>
              <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg">
                Generate Report
              </button>
            </div>

            <div className="bg-slate-950/60 rounded-lg border border-white/10 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-gray-400">
                Next Filing Due: <span className="text-red-400 font-bold">15th</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-1 rounded bg-green-100 text-green-800">TCC: Active</span>
                <span className="text-[10px] font-bold px-2 py-1 rounded bg-blue-100 text-blue-800">VAT: Standard</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 bg-gradient-to-r from-blue-900 to-blue-700 text-white rounded-xl shadow-sm border border-blue-500/30">
          <CardContent className="p-6 space-y-3">
            <h3 className="text-base font-bold text-myamber">Empire Advisor AI</h3>
            <p className="text-xs text-blue-100">Real-time ecosystem analysis & strategy.</p>
            <button className="w-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-2 rounded-lg border border-white/20">
              Generate Strategy
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

