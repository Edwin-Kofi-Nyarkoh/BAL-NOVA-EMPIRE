"use client"

import { useEffect, useMemo, useState } from "react"
import { AdminShell } from "@/components/dashboard/admin-shell"
import { cn, formatCurrency } from "@/lib/utils"
import { getJSON, requestJSON } from "@/lib/sync"
import { useDialog } from "@/components/ui/dialog-service"

type Order = {
  id: string
  item: string
  price: number
  status: string
  createdAt: string
  origin?: string | null
  riderId?: string | null
}

type Ledger = {
  id: string
  userId: string
  type: string
  amount: number
  status: string
  note?: string | null
  createdAt: string
}

type Audit = {
  id: string
  action: string
  entityType: string
  entityId?: string | null
  createdAt: string
}

type Insights = {
  ordersSummary: { total: number; pending: number; delivered: number; assigned: number }
  smartEta: { avgMinutes: number; medianMinutes: number; sampleSize: number }
  systemLoad: { ordersLastHour: number; ordersLast24h: number; activeRiders: number; pendingOrders: number }
  reverseLogistics: { returns: number }
  profitWaterfall: { revenue: number; costs: number; net: number }
  unitEconomics: { avgOrderValue: number; orders: number }
  revenueVariance: { current7d: number; previous7d: number; deltaPct: number }
  heatmap: { lat: number; lng: number; count: number }[]
  routeSolver: { lastAutoAssignAt: string | null; assignRate: number; unassignedWithCoords: number }
  qc: { totalLogs: number }
}

type User = {
  id: string
  role: string
  approvalStatus: string
  createdAt: string
  email?: string | null
  name?: string | null
}

type TabKey =
  | "overview"
  | "executive"
  | "strategy"
  | "logistics"
  | "fleet"
  | "qc"
  | "customers"
  | "vendors"
  | "resellers"
  | "pros"
  | "analytics"
  | "system"

export default function AdminPortalPage() {
  const dialog = useDialog()
  const [tab, setTab] = useState<TabKey>("overview")
  const [orders, setOrders] = useState<Order[]>([])
  const [ledger, setLedger] = useState<Ledger[]>([])
  const [audits, setAudits] = useState<Audit[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [insights, setInsights] = useState<Insights | null>(null)
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiResponse, setAiResponse] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [priceDelta, setPriceDelta] = useState("0")
  const [volumeDelta, setVolumeDelta] = useState("0")

  useEffect(() => {
    void loadAll()
  }, [])

  async function loadAll() {
    const o = await getJSON<{ orders?: Order[] }>("/api/orders?all=1", {})
    setOrders(Array.isArray(o.orders) ? o.orders : [])
    const l = await getJSON<{ entries?: Ledger[] }>("/api/finance/ledger?limit=200", {})
    setLedger(Array.isArray(l.entries) ? l.entries : [])
    const a = await getJSON<{ logs?: Audit[] }>("/api/audit?take=200", {})
    setAudits(Array.isArray(a.logs) ? a.logs : [])
    const u = await getJSON<{ users?: User[] }>("/api/users", {})
    setUsers(Array.isArray(u.users) ? u.users : [])
    const s = await getJSON<{ settings?: { apiKey?: string } }>("/api/settings", {})
    if (s.settings?.apiKey) setApiKey(s.settings.apiKey)
    const i = await getJSON<Insights>("/api/admin/insights", {} as Insights)
    setInsights(i)
  }

  const revenue = useMemo(() => orders.reduce((sum, o) => sum + (o.price || 0), 0), [orders])
  const completed = useMemo(() => orders.filter((o) => ["Delivered", "Completed", "Paid"].includes(o.status)).length, [orders])
  const pending = useMemo(() => orders.filter((o) => !["Delivered", "Completed"].includes(o.status)).length, [orders])
  const totalUsers = users.length
  const vendors = users.filter((u) => u.role === "vendor").length
  const resellers = users.filter((u) => u.role === "reseller").length
  const pros = users.filter((u) => u.role === "pro").length
  const riders = users.filter((u) => u.role === "rider").length

  const recentLedger = ledger.slice(0, 8)
  const lastAutoAssign = useMemo(
    () => audits.find((a) => a.action === "orders.auto_assign"),
    [audits]
  )
  const avgOrderValue = insights?.unitEconomics?.avgOrderValue || (orders.length ? revenue / orders.length : 0)
  const ledgerRevenue = insights?.profitWaterfall?.revenue || ledger.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0)
  const ledgerCosts = insights?.profitWaterfall?.costs || ledger.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0)
  const revenueVariance = insights?.revenueVariance || { current7d: 0, previous7d: 0, deltaPct: 0 }
  const sensitivityImpact = useMemo(() => {
    const pd = Number(priceDelta || 0) / 100
    const vd = Number(volumeDelta || 0) / 100
    const base = revenue
    const next = base * (1 + pd) * (1 + vd)
    return { base, next }
  }, [priceDelta, volumeDelta, revenue])

  async function runAdvisor() {
    if (!apiKey || !aiPrompt.trim()) return
    setAiLoading(true)
    try {
      const text = await callGemini(apiKey, aiPrompt.trim())
      setAiResponse(text)
    } finally {
      setAiLoading(false)
    }
  }

  async function exportLedgerCsv() {
    const rows = ["id,type,amount,status,note,createdAt"]
    for (const e of ledger) {
      rows.push(`${e.id},${e.type},${e.amount},${e.status},${(e.note || "").replace(/,/g, " ")},${e.createdAt}`)
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ledger-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const nav: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "executive", label: "Executive" },
    { key: "strategy", label: "Strategy" },
    { key: "logistics", label: "Logistics" },
    { key: "fleet", label: "Fleet" },
    { key: "qc", label: "QC" },
    { key: "customers", label: "Customers" },
    { key: "vendors", label: "Vendors" },
    { key: "resellers", label: "Resellers" },
    { key: "pros", label: "Pros" },
    { key: "analytics", label: "Analytics" },
    { key: "system", label: "System" }
  ]

  return (
    <AdminShell title="Empire HQ" subtitle="Unified command center">
      <div className="flex flex-wrap gap-2 mb-6">
        {nav.map((n) => (
          <button
            key={n.key}
            onClick={() => setTab(n.key)}
            className={cn(
              "text-xs font-bold px-3 py-2 rounded-full border",
              tab === n.key ? "border-myamber text-myamber bg-myamber/10" : "border-gray-200 dark:border-gray-700"
            )}
          >
            {n.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="text-xs text-gray-400 uppercase">Revenue</div>
            <div className="text-2xl font-bold">{formatCurrency(revenue)}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="text-xs text-gray-400 uppercase">Orders</div>
            <div className="text-2xl font-bold">{orders.length}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="text-xs text-gray-400 uppercase">Completed</div>
            <div className="text-2xl font-bold">{completed}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="text-xs text-gray-400 uppercase">Active Users</div>
            <div className="text-2xl font-bold">{totalUsers}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="text-xs text-gray-400 uppercase">System Load (24h)</div>
            <div className="text-2xl font-bold">{insights?.systemLoad?.ordersLast24h ?? 0}</div>
            <div className="text-[10px] text-gray-400">Last hour: {insights?.systemLoad?.ordersLastHour ?? 0}</div>
          </div>
        </div>
      ) : null}

      {tab === "executive" ? (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="font-bold mb-2">Rider Performance Matrix</div>
            <div className="text-xs text-gray-500">Riders: {riders} · Pending Orders: {pending}</div>
          </div>
        </div>
      ) : null}

      {tab === "strategy" ? (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="font-bold mb-2">Empire Advisor AI</div>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={3}
              className="w-full p-3 border rounded-lg text-sm dark:bg-gray-900 dark:border-gray-700"
              placeholder="Ask about margin, pricing, or growth strategy..."
            />
            <button
              onClick={runAdvisor}
              className="mt-3 text-xs font-bold bg-mynavy text-white px-3 py-2 rounded"
            >
              {aiLoading ? "Thinking..." : "Run Advisor"}
            </button>
            {aiResponse ? <div className="mt-3 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{aiResponse}</div> : null}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="font-bold mb-2">Sensitivity Analysis</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500">Price Change (%)</label>
                <input
                  value={priceDelta}
                  onChange={(e) => setPriceDelta(e.target.value)}
                  className="w-full p-2 rounded border dark:bg-gray-900 dark:border-gray-700 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500">Volume Change (%)</label>
                <input
                  value={volumeDelta}
                  onChange={(e) => setVolumeDelta(e.target.value)}
                  className="w-full p-2 rounded border dark:bg-gray-900 dark:border-gray-700 text-xs"
                />
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-3">
              Base revenue: {formatCurrency(sensitivityImpact.base)} → Projected: {formatCurrency(sensitivityImpact.next)}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="font-bold mb-2">Shadow Price Alert</div>
            <div className="text-xs text-gray-500">
              {avgOrderValue < 20
                ? "Alert: Average order value is below target threshold."
                : "No shadow price alerts detected."}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "logistics" ? (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="font-bold mb-2">Dispatch Summary</div>
            <div className="text-xs text-gray-500">Assigned Orders: {orders.filter((o) => o.riderId).length}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="font-bold mb-2">VRP Solver Status</div>
            <div className="text-xs text-gray-500">
              Last Auto-Assign: {insights?.routeSolver?.lastAutoAssignAt ? new Date(insights.routeSolver.lastAutoAssignAt).toLocaleString() : "No runs yet"}
            </div>
            <div className="text-xs text-gray-500">Assign rate (coords): {insights?.routeSolver?.assignRate ?? 0}%</div>
            <div className="text-xs text-gray-500">Unassigned with coords: {insights?.routeSolver?.unassignedWithCoords ?? 0}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="font-bold mb-2">Bus Route Optimizer</div>
            <div className="text-xs text-gray-500">Pending Orders Queue: {pending}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="font-bold mb-2">Smart ETA</div>
            <div className="text-xs text-gray-500">
              Avg: {insights?.smartEta?.avgMinutes ?? 0}m · Median: {insights?.smartEta?.medianMinutes ?? 0}m
            </div>
            <div className="text-[10px] text-gray-400">Samples: {insights?.smartEta?.sampleSize ?? 0}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="font-bold mb-2">Reverse Logistics</div>
            <div className="text-xs text-gray-500">Returns flagged: {insights?.reverseLogistics?.returns ?? 0}</div>
          </div>
        </div>
      ) : null}

      {tab === "fleet" ? (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="font-bold mb-2">Fleet Status</div>
            <div className="text-xs text-gray-500">Active Riders: {riders}</div>
          </div>
        </div>
      ) : null}

      {tab === "qc" ? (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="font-bold mb-2">Latest QC Logs</div>
            <button
              onClick={async () => {
                const status = await dialog.prompt("QC Status", { defaultValue: "passed" })
                if (!status) return
                const message = await dialog.prompt("QC Message", { placeholder: "Describe the QC check" })
                if (!message) return
                await requestJSON("/api/qc", { status, message }, "POST", {})
              }}
              className="text-xs font-bold bg-myamber text-myblue px-3 py-2 rounded"
            >
              Log QC Event
            </button>
          </div>
        </div>
      ) : null}

      {tab === "customers" ? (
        <div className="space-y-2">
          <div className="text-sm text-gray-500">Total Users: {totalUsers}</div>
        </div>
      ) : null}

      {tab === "vendors" ? (
        <div className="space-y-2">
          <div className="text-sm text-gray-500">Vendors: {vendors}</div>
        </div>
      ) : null}

      {tab === "resellers" ? (
        <div className="space-y-2">
          <div className="text-sm text-gray-500">Resellers: {resellers}</div>
        </div>
      ) : null}

      {tab === "pros" ? (
        <div className="space-y-2">
          <div className="text-sm text-gray-500">Pros: {pros}</div>
        </div>
      ) : null}

      {tab === "analytics" ? (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="font-bold mb-2">Revenue Trend</div>
            <div className="text-xs text-gray-500">Recent Ledger Entries</div>
            <div className="mt-2 space-y-2">
              {recentLedger.map((e) => (
                <div key={e.id} className="text-xs flex justify-between">
                  <span>{e.type}</span>
                  <span>{formatCurrency(e.amount)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="font-bold mb-2">Revenue Variance (7 days)</div>
            <div className="text-xs text-gray-500">
              Current: {formatCurrency(revenueVariance.current7d)} · Previous: {formatCurrency(revenueVariance.previous7d)}
            </div>
            <div className={cn(
              "text-xs font-bold mt-1",
              revenueVariance.deltaPct >= 0 ? "text-emerald-600" : "text-red-500"
            )}>
              {revenueVariance.deltaPct.toFixed(1)}%
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="font-bold mb-2">Unit Economics</div>
            <div className="text-xs text-gray-500">Average order value: {formatCurrency(avgOrderValue)}</div>
            <div className="text-xs text-gray-500">Orders: {orders.length}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="font-bold mb-2">Customer Segmentation</div>
            <div className="text-xs text-gray-500">Vendors: {vendors} · Resellers: {resellers} · Pros: {pros}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="font-bold mb-2">Spatial Heatmap (Zones)</div>
            {insights?.heatmap?.length ? (
              <div className="text-xs text-gray-500">
                {insights.heatmap.slice(0, 6).map((z) => (
                  <div key={`${z.lat}-${z.lng}`} className="flex justify-between">
                    <span>{z.lat.toFixed(1)}, {z.lng.toFixed(1)}</span>
                    <span>{z.count} orders</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">No coordinate data yet.</div>
            )}
          </div>
        </div>
      ) : null}

      {tab === "system" ? (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="font-bold mb-2">Accountant Export Module</div>
            <button onClick={exportLedgerCsv} className="text-xs font-bold bg-myamber text-myblue px-3 py-2 rounded">
              Export Ledger CSV
            </button>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="font-bold mb-2">Profit Waterfall</div>
            <div className="text-xs text-gray-500">Revenue: {formatCurrency(ledgerRevenue)}</div>
            <div className="text-xs text-gray-500">Costs: {formatCurrency(ledgerCosts)}</div>
            <div className="text-xs text-gray-500">Net: {formatCurrency(ledgerRevenue + ledgerCosts)}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="font-bold mb-2">Recent Audit Logs</div>
            <div className="text-xs text-gray-500">Last {audits.slice(0, 5).length} events</div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  )
}

async function callGemini(apiKey: string, prompt: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    }
  )
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  return typeof text === "string" ? text : "AI Service Unavailable"
}
