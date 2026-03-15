// components/dashboard/DispatchTower.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { Monitor, Zap, MapPin, PhoneCall, ShieldCheck, Truck } from "lucide-react"
import { requestJSON } from "@/lib/sync"

type OrderRow = {
  id: string
  item: string
  status: string
  origin?: string | null
  createdAt: string
  price?: number | null
}

export function DispatchTower() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [bayCapacity, setBayCapacity] = useState(85)
  const [bayHotPct, setBayHotPct] = useState(80)
  const [bayACapacity, setBayACapacity] = useState<number | null>(null)
  const [bayBCapacity, setBayBCapacity] = useState<number | null>(null)
  const [bayAHotPct, setBayAHotPct] = useState<number | null>(null)
  const [bayBHotPct, setBayBHotPct] = useState<number | null>(null)
  const [autoHot, setAutoHot] = useState(true)
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [ordersRes, settingsRes] = await Promise.all([
          fetch("/api/orders?all=1"),
          fetch("/api/settings")
        ])
        const data = await ordersRes.json()
        const settingsJson = settingsRes.ok ? await settingsRes.json().catch(() => ({})) : {}
        if (!active) return
        setOrders(Array.isArray(data.orders) ? data.orders : [])
        if (settingsJson?.settings?.bayCapacity) setBayCapacity(Number(settingsJson.settings.bayCapacity))
        if (settingsJson?.settings?.bayHotPct) setBayHotPct(Number(settingsJson.settings.bayHotPct))
        if (settingsJson?.settings?.bayACapacity) setBayACapacity(Number(settingsJson.settings.bayACapacity))
        if (settingsJson?.settings?.bayBCapacity) setBayBCapacity(Number(settingsJson.settings.bayBCapacity))
        if (settingsJson?.settings?.bayAHotPct) setBayAHotPct(Number(settingsJson.settings.bayAHotPct))
        if (settingsJson?.settings?.bayBHotPct) setBayBHotPct(Number(settingsJson.settings.bayBHotPct))
        if (typeof settingsJson?.settings?.bayAutoHot === "boolean") setAutoHot(settingsJson.settings.bayAutoHot)
      } catch {
        if (!active) return
        setOrders([])
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
  const inProgress = useMemo(
    () => orders.filter((o) => !["pending", "delivered"].includes(o.status?.toLowerCase() || "")),
    [orders]
  )
  const delivered = useMemo(() => orders.filter((o) => o.status?.toLowerCase() === "delivered"), [orders])
  const charterRequests = useMemo(
    () => pending.filter((o) => (o.origin || "").toLowerCase().includes("charter")),
    [pending]
  )

  const lastHourOrders = useMemo(() => {
    if (!now) return []
    const cutoff = now - 60 * 60 * 1000
    return orders.filter((o) => new Date(o.createdAt).getTime() >= cutoff)
  }, [orders, now])

  const activeFleetCount = useMemo(() => inProgress.length, [inProgress])
  const systemLoadPct = useMemo(() => {
    if (!orders.length) return 0
    return Math.min(100, Math.round((pending.length / orders.length) * 100))
  }, [pending, orders])

  const bayAOrders = useMemo(() => {
    return orders.filter((o) => {
      const origin = (o.origin || "").toLowerCase()
      return origin.includes("metro") || origin.includes("spintex") || origin.includes("core")
    })
  }, [orders])
  const bayBOrders = useMemo(() => {
    return orders.filter((o) => {
      const origin = (o.origin || "").toLowerCase()
      return !origin || (!origin.includes("metro") && !origin.includes("spintex") && !origin.includes("core"))
    })
  }, [orders])
  const bayACap = bayACapacity ?? bayCapacity
  const bayBCap = bayBCapacity ?? bayCapacity
  const bayAHot = bayAHotPct ?? bayHotPct
  const bayBHot = bayBHotPct ?? bayHotPct
  const bayAHotThreshold = Math.max(1, Math.round((bayACap * bayAHot) / 100))
  const bayBHotThreshold = Math.max(1, Math.round((bayBCap * bayBHot) / 100))
  const shouldHotA = autoHot && bayAOrders.length >= bayAHotThreshold
  const shouldHotB = autoHot && bayBOrders.length >= bayBHotThreshold
  const bayAPct = Math.min(100, Math.round((bayAOrders.length / Math.max(1, bayACap)) * 100))
  const bayBPct = Math.min(100, Math.round((bayBOrders.length / Math.max(1, bayBCap)) * 100))
  const bayAColor = bayAPct >= bayAHot ? "bg-red-500" : bayAPct >= Math.round(bayAHot * 0.75) ? "bg-amber-400" : "bg-blue-500"
  const bayBColor = bayBPct >= bayBHot ? "bg-red-500" : bayBPct >= Math.round(bayBHot * 0.75) ? "bg-amber-400" : "bg-purple-500"

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-900 via-mynavy to-mynavy rounded-xl p-6 text-white border border-purple-500 shadow-lg relative overflow-hidden">
        <div className="scanning-line" />
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Truck size={80} />
        </div>
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 border-r border-white/10 pr-6">
            <h3 className="font-bold text-myamber mb-1 flex items-center gap-2">
              <PhoneCall size={14} /> Incoming Charters
            </h3>
            <p className="text-xs text-purple-200 mb-4">Manual intercept required.</p>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
              {charterRequests.length === 0 ? (
                <div className="text-xs text-gray-300 italic">No pending charter requests.</div>
              ) : (
                charterRequests.map((c) => (
                  <div key={c.id} className="bg-black/30 rounded-lg p-2 text-xs">
                    <div className="font-semibold">{c.item}</div>
                    <div className="text-[10px] text-gray-300">{c.origin || "Charter"}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-1 border-r border-white/10 pr-6">
            <h3 className="font-bold text-white mb-1">Van Unit 1 Control</h3>
            <p className="text-xs text-gray-400 mb-4">Override auto-pilot for gigs.</p>
            <div className="bg-black/30 rounded-lg p-3 border border-white/10 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase text-gray-500">Current Status</div>
                <div className="font-bold text-green-400">
                  {pending.length > 0 ? "BUSY (QUEUED)" : "AVAILABLE (B2B)"}
                </div>
              </div>
              <span className="bg-white/10 text-white text-xs font-bold px-3 py-2 rounded-lg">
                {pending.length > 0 ? "HOLD" : "READY"}
              </span>
            </div>
          </div>

          <div className="lg:col-span-1">
            <h3 className="font-bold text-green-400 mb-1">Cash Cow Entry</h3>
            <p className="text-xs text-gray-400 mb-4">Record off-platform cash.</p>
            <button
              onClick={() => (window.location.href = "/finance-ledger")}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <ShieldCheck size={14} /> Open Profit Waterfall
            </button>
          </div>
        </div>
      </div>

      <div className="bg-mynavy rounded-xl p-6 text-white relative overflow-hidden mb-6">
        <div className="scanning-line opacity-40" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h3 className="font-bold text-xl text-myamber mb-1">Route Optimizer</h3>
            <p className="text-sm text-blue-200">
              Center: <strong className="text-white">Live Network</strong>. Fleet rescue protocol.
            </p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <div className="border border-white/20 rounded-lg p-3 flex-1 md:w-32 text-center bg-white/5">
              <div className="text-[10px] text-gray-400 uppercase tracking-widest">Active Fleet</div>
              <div className="text-xl font-bold font-mono">
                {activeFleetCount}/{Math.max(activeFleetCount, 1)}
              </div>
            </div>
            <div className="border border-white/20 rounded-lg p-3 flex-1 md:w-32 text-center bg-white/5">
              <div className="text-[10px] text-gray-400 uppercase tracking-widest">System Load</div>
              <div className="text-xl font-bold font-mono">{systemLoadPct}%</div>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end md:self-center">
            <span className="text-xs font-bold uppercase">AUTO PILOT</span>
            <div className="w-8 h-4 rounded-full bg-green-500" />
            <label className="flex items-center gap-2 text-[10px] font-bold uppercase">
              Auto‑Hot
              <span className="relative inline-flex h-5 w-10 items-center">
                <input
                  type="checkbox"
                  checked={autoHot}
                  onChange={(e) => {
                    const next = e.target.checked
                    setAutoHot(next)
                    void requestJSON("/api/settings", { bayAutoHot: next }, "PUT", {})
                  }}
                  className="peer sr-only"
                />
                <span className="h-5 w-10 rounded-full bg-gray-400/60 peer-checked:bg-green-500 transition-colors peer-checked:shadow-[0_0_12px_rgba(34,197,94,0.6)]" />
                <span className="absolute left-1 top-1 h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
              </span>
              <span className="text-[9px] text-gray-200">
                {autoHot ? "ON" : "OFF"}
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border-l-4 border-blue-500 cargo-box ${
            shouldHotA ? "bay-hot" : ""
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <div>
              <h3 className="font-bold text-lg dark:text-white">Bay A: Metro (Core)</h3>
              <p className="text-[10px] text-gray-400">Short Haul (Zone 1)</p>
            </div>
            <div className="text-xs font-mono text-gray-500">
              Vol: <span className="font-bold">{bayAOrders.length}</span>/{bayACap}
            </div>
          </div>
          <div className="space-y-2 mb-4">
            <div>
              <div className="flex justify-between text-[10px] mb-1 text-gray-500">
                <span>Physical Load (Target: {bayAHot}% hot)</span>
                <span className="font-bold">{bayAPct}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                <div
                  className={`${bayAColor} h-1.5 rounded-full transition-all duration-500`}
                  style={{
                    width: `${bayAPct}%`
                  }}
                />
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-[100px] border-t pt-2 border-dashed border-gray-300 dark:border-gray-700">
            {bayAOrders.length === 0 ? (
              <div className="text-xs text-gray-500">Waiting for Metro orders.</div>
            ) : (
              bayAOrders.slice(0, 8).map((o) => (
                <div key={o.id} className="flex items-center justify-between text-xs py-2 border-b border-gray-100 dark:border-gray-700">
                  <div className="font-semibold">{o.item}</div>
                  <span className="text-gray-400">{o.status}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div
          className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border-l-4 border-purple-500 cargo-box ${
            shouldHotB ? "bay-hot" : ""
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <div>
              <h3 className="font-bold text-lg dark:text-white">Bay B: Long Haul</h3>
              <p className="text-[10px] text-purple-400 font-bold uppercase">Cross-Docking / Van</p>
            </div>
            <div className="text-xs font-mono text-gray-500">
              Vol: <span className="font-bold">{bayBOrders.length}</span>/{bayBCap}
            </div>
          </div>
          <div className="space-y-2 mb-4">
            <div>
              <div className="flex justify-between text-[10px] mb-1 text-gray-500">
                <span>Physical Load (Target: {bayBHot}% hot)</span>
                <span className="font-bold">{bayBPct}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                <div
                  className={`${bayBColor} h-1.5 rounded-full transition-all duration-500`}
                  style={{
                    width: `${bayBPct}%`
                  }}
                />
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-[100px] border-t pt-2 border-dashed border-gray-300 dark:border-gray-700">
            {bayBOrders.length === 0 ? (
              <div className="text-xs text-gray-500">Waiting for Long Haul orders.</div>
            ) : (
              bayBOrders.slice(0, 8).map((o) => (
                <div key={o.id} className="flex items-center justify-between text-xs py-2 border-b border-gray-100 dark:border-gray-700">
                  <div className="font-semibold">{o.item}</div>
                  <span className="text-gray-400">{o.status}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
