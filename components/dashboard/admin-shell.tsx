// components/dashboard/admin-shell.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { ModeToggle } from "@/components/ui/mode-toggle"
import { LogoutButton } from "@/components/logout-button"
import { cn } from "@/lib/utils"
import { Menu } from "lucide-react"
import { OperationalAlerts } from "@/components/dashboard/operational-alerts"
import { signOut, useSession } from "next-auth/react"
import { useToast } from "@/components/ui/toast-service"

type AdminShellProps = {
  title: string
  subtitle?: string
  children: React.ReactNode
}

export function AdminShell({ title, subtitle, children }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [health, setHealth] = useState<"loading" | "ok" | "error">("loading")
  const [healthError, setHealthError] = useState("")
  const [sessionOk, setSessionOk] = useState<"loading" | "ok" | "error">("loading")
  const [sessionError, setSessionError] = useState("")
  const [healthTipOpen, setHealthTipOpen] = useState(false)
  const [authTipOpen, setAuthTipOpen] = useState(false)
  const [region, setRegion] = useState("GH")
  const [weather, setWeather] = useState<{ tempC: number; summary: string; location: string } | null>(null)
  const [weatherError, setWeatherError] = useState("")
  const [autoPilot, setAutoPilot] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [showRateModal, setShowRateModal] = useState(false)
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false)
  const [opsMenuOpen, setOpsMenuOpen] = useState(false)
  const [regionMenuOpen, setRegionMenuOpen] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [expenseForm, setExpenseForm] = useState({ type: "Fuel", amount: "", note: "" })
  const [rateForm, setRateForm] = useState({ fx: "", air: "", sea: "", roadKm: "", roadBase: "", border: "", local: "" })
  const [maintForm, setMaintForm] = useState({ category: "Hub", assetId: "", cost: "", lockInWorkshop: false })
  const { data: session, status: sessionStatus } = useSession()
  const role = ((session?.user as any)?.role || "") as string
  const toast = useToast()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [atBottom, setAtBottom] = useState(false)

  useEffect(() => {
    let active = true
    async function checkHealth() {
      try {
        const res = await fetch("/api/health")
        const data = await res.json().catch(() => ({}))
        if (!active) return
        setHealth(data?.db === "ok" ? "ok" : "error")
        setHealthError(data?.error || "")
      } catch {
        if (!active) return
        setHealth("error")
        setHealthError("Health endpoint unreachable.")
      }
    }

    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session")
        if (!active) return
        setSessionOk(res.ok ? "ok" : "error")
        if (!res.ok) {
          setSessionError("Session endpoint returned error.")
        } else {
          setSessionError("")
        }
      } catch {
        if (!active) return
        setSessionOk("error")
        setSessionError("Session endpoint unreachable.")
      }
    }

    checkHealth()
    checkSession()
    const interval = setInterval(() => {
      checkHealth()
      checkSession()
    }, 45000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (sessionStatus === "authenticated") return
    const timer = setTimeout(() => {
      void signOut({ redirect: false })
      window.location.href = "/"
    }, 8000)
    return () => clearTimeout(timer)
  }, [sessionStatus])

  useEffect(() => {
    let active = true
    async function loadRateCard() {
      try {
        const res = await fetch("/api/rate-card")
        const data = await res.json().catch(() => ({}))
        if (!active) return
        if (data?.card) {
          setRateForm((prev) => ({ ...prev, ...data.card }))
        }
      } catch {
        // ignore
      }
    }
    loadRateCard()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    async function loadMe() {
      try {
        const res = await fetch("/api/me")
        const data = await res.json().catch(() => ({}))
        if (!active) return
        if (data?.user?.id) setCurrentUserId(String(data.user.id))
      } catch {
        // ignore
      }
    }
    loadMe()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings")
        const data = await res.json().catch(() => ({}))
        if (!active) return
        if (data?.settings?.region) setRegion(String(data.settings.region))
      } catch {
        // ignore
      }
    }
    loadSettings()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    async function loadWeather() {
      try {
        const res = await fetch(`/api/weather?region=${encodeURIComponent(region)}`)
        const data = await res.json().catch(() => ({}))
        if (!active) return
        if (res.ok && data?.tempC !== undefined) {
          setWeather({ tempC: Number(data.tempC), summary: String(data.summary || ""), location: String(data.location || "") })
          setWeatherError("")
        } else {
          setWeather(null)
          setWeatherError(data?.error || "Weather unavailable")
        }
      } catch {
        if (!active) return
        setWeather(null)
        setWeatherError("Weather unavailable")
      }
    }
    loadWeather()
    const interval = setInterval(loadWeather, 300000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [region])

  async function switchRegion(next: string) {
    setRegion(next)
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region: next })
    })
  }

  useEffect(() => {
    function onScroll() {
      const el = scrollRef.current
      if (!el) return
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20
      setAtBottom(nearBottom)
    }
    onScroll()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener("scroll", onScroll)
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  function toggleScrollPos() {
    const el = scrollRef.current
    if (!el) return
    if (atBottom) {
      el.scrollTo({ top: 0, behavior: "smooth" })
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
    }
  }

  async function submitExpense() {
    if (!currentUserId) {
      toast.push("No user context found.", "error")
      return
    }
    const amount = Number(expenseForm.amount || 0)
    if (!amount || amount <= 0) {
      toast.push("Enter a valid amount.", "warning")
      return
    }
    const res = await fetch("/api/finance/ledger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentUserId,
        type: "ADJUSTMENT",
        amount: -Math.abs(amount),
        status: "manual",
        note: `${expenseForm.type}${expenseForm.note ? `: ${expenseForm.note}` : ""}`
      })
    })
    if (!res.ok) {
      toast.push("Failed to log expense.", "error")
      return
    }
    toast.push("Expense logged.")
    setExpenseForm({ type: "Fuel", amount: "", note: "" })
    setShowExpenseModal(false)
  }

  async function saveRateCard() {
    const payload = {
      fx: Number(rateForm.fx || 0) || undefined,
      air: Number(rateForm.air || 0) || undefined,
      sea: Number(rateForm.sea || 0) || undefined,
      roadKm: Number(rateForm.roadKm || 0) || undefined,
      roadBase: Number(rateForm.roadBase || 0) || undefined,
      border: Number(rateForm.border || 0) || undefined,
      local: Number(rateForm.local || 0) || undefined
    }
    const res = await fetch("/api/rate-card", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      toast.push("Failed to save rate card.", "error")
      return
    }
    toast.push("Rate card saved.")
    setShowRateModal(false)
  }

  async function submitMaintenance() {
    if (!currentUserId) {
      toast.push("No user context found.", "error")
      return
    }
    const amount = Number(maintForm.cost || 0)
    if (!amount || amount <= 0) {
      toast.push("Enter a valid maintenance cost.", "warning")
      return
    }
    await fetch("/api/finance/ledger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentUserId,
        type: "ADJUSTMENT",
        amount: -Math.abs(amount),
        status: "manual",
        note: `Maintenance: ${maintForm.category} ${maintForm.assetId ? `[${maintForm.assetId}]` : ""}`
      })
    })
    await fetch("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: maintForm.category,
        assetId: maintForm.assetId,
        cost: amount,
        lockInWorkshop: maintForm.lockInWorkshop
      })
    })
    toast.push("Maintenance recorded.")
    setMaintForm({ category: "Hub", assetId: "", cost: "", lockInWorkshop: false })
    setShowMaintenanceModal(false)
  }

  return (
    <div className="bg-white text-gray-800 dark:bg-mydark dark:text-gray-100 overflow-hidden h-screen flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div
        className={cn("fixed inset-0 bg-black/50 z-40 md:hidden", sidebarOpen ? "block" : "hidden")}
        onClick={() => setSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative pt-16 md:pt-0 md:ml-64">
        <div className={cn("scanning-line", autoPilot ? "opacity-100" : "opacity-0")} />
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-16 flex items-center justify-between px-6 shrink-0 transition-colors">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-gray-500 hover:text-mynavy"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-xl font-bold text-mynavy dark:text-white">{title}</h2>
              {subtitle ? <p className="text-[10px] text-gray-500 -mt-0.5">{subtitle}</p> : null}
            </div>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => setAutoPilot((v) => !v)}
                className={cn(
                  "text-xs font-bold px-3 py-1.5 rounded-full border transition",
                  autoPilot
                    ? "border-myamber text-myamber bg-myamber/10"
                    : "border-gray-300 dark:border-gray-600 text-gray-500"
                )}
              >
                Auto-Pilot
              </button>
              <div className="relative">
                <button
                  className="text-xs font-bold px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => setOpsMenuOpen((v) => !v)}
                  onBlur={() => setTimeout(() => setOpsMenuOpen(false), 150)}
                >
                  Ops Tools
                </button>
                <div className={cn(
                  "absolute right-0 top-full mt-2 w-44 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg transition z-50",
                  opsMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setShowExpenseModal(true)
                      setOpsMenuOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    Log Burn Rate
                  </button>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setShowRateModal(true)
                      setOpsMenuOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    Rate Card
                  </button>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setShowMaintenanceModal(true)
                      setOpsMenuOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    Maintenance Log
                  </button>
                </div>
              </div>
            </div>
            {sessionStatus === "authenticated" && role ? (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-myamber/40 bg-myamber/10 text-myamber text-xs font-bold">
                Role: {role.charAt(0).toUpperCase() + role.slice(1)}
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-300/40 bg-gray-100 text-gray-500 text-xs font-semibold">
                Role: Checking...
              </div>
            )}
            <div className="relative hidden md:block">
              <button
                className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600"
                onClick={() => setRegionMenuOpen((v) => !v)}
                onBlur={() => setTimeout(() => setRegionMenuOpen(false), 150)}
              >
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{region}</span>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                  {region === "GH" ? "Ghana (Active)" : region === "NG" ? "Nigeria (Active)" : region === "CI" ? "Cote d'Ivoire (Active)" : "Region (Active)"}
                </span>
              </button>
              <div className={cn(
                "absolute right-0 top-full mt-2 w-48 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg transition z-50",
                regionMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
              )}>
                {["GH", "NG", "CI"].map((code) => (
                  <button
                    key={code}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      void switchRegion(code)
                      setRegionMenuOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    {code === "GH" ? "Ghana (HQ)" : code === "NG" ? "Nigeria" : "Cote d'Ivoire"}
                  </button>
                ))}
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2 text-xs font-bold text-gray-500 mr-2 border-r border-gray-300 dark:border-gray-600 pr-4 h-8">
              {weather ? `${weather.location}: ${weather.tempC}°C · ${weather.summary}` : weatherError || "Uplink..."}
            </div>

            <div className="relative hidden md:block">
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-500 cursor-pointer select-none",
                health === "ok" && "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800",
                health === "error" && "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800",
                health === "loading" && "bg-gray-100 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700"
              )}
                role="button"
                tabIndex={0}
                onClick={() => setHealthTipOpen((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setHealthTipOpen((v) => !v)
                  }
                }}
                onBlur={() => setHealthTipOpen(false)}
              >
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  health === "ok" && "bg-green-500 pulse-dot",
                  health === "error" && "bg-red-500",
                  health === "loading" && "bg-gray-400"
                )}
              />
              <span
                className={cn(
                  "text-xs font-bold",
                  health === "ok" && "text-green-700 dark:text-green-400",
                  health === "error" && "text-red-600 dark:text-red-400",
                  health === "loading" && "text-gray-500"
                )}
              >
                {health === "ok" ? "System Normal" : health === "error" ? "DB Issue" : "Checking DB"}
              </span>
            </div>
              <div className={cn(
                "pointer-events-none absolute right-0 top-10 z-50 w-56 rounded-lg border border-gray-200/80 bg-white px-3 py-2 text-[11px] text-gray-600 shadow-lg transition dark:border-white/10 dark:bg-mydark dark:text-gray-300",
                healthTipOpen ? "opacity-100" : "opacity-0"
              )}>
                {health === "error"
                  ? (healthError || "Database check failed.")
                  : "Database health status"}
              </div>
            </div>

            <div className="relative hidden md:block">
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-500 cursor-pointer select-none",
                sessionOk === "ok" && "bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800",
                sessionOk === "error" && "bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800",
                sessionOk === "loading" && "bg-gray-100 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700"
              )}
                role="button"
                tabIndex={0}
                onClick={() => setAuthTipOpen((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setAuthTipOpen((v) => !v)
                  }
                }}
                onBlur={() => setAuthTipOpen(false)}
              >
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  sessionOk === "ok" && "bg-blue-500 pulse-dot",
                  sessionOk === "error" && "bg-orange-500",
                  sessionOk === "loading" && "bg-gray-400"
                )}
              />
              <span
                className={cn(
                  "text-xs font-bold",
                  sessionOk === "ok" && "text-blue-700 dark:text-blue-400",
                  sessionOk === "error" && "text-orange-600 dark:text-orange-400",
                  sessionOk === "loading" && "text-gray-500"
                )}
              >
                {sessionOk === "ok" ? "Auth OK" : sessionOk === "error" ? "Auth Error" : "Auth Check"}
              </span>
            </div>
              <div className={cn(
                "pointer-events-none absolute right-0 top-10 z-50 w-56 rounded-lg border border-gray-200/80 bg-white px-3 py-2 text-[11px] text-gray-600 shadow-lg transition dark:border-white/10 dark:bg-mydark dark:text-gray-300",
                authTipOpen ? "opacity-100" : "opacity-0"
              )}>
                {sessionOk === "error"
                  ? (sessionError || "Auth check failed.")
                  : "Authentication status"}
              </div>
            </div>

            <ModeToggle />
            <LogoutButton className="inline-flex text-xs font-bold px-3 py-2 rounded-full border border-myamber/30 text-myamber hover:bg-myamber/10 transition-colors" />
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth relative">
          <div className="mb-4">
            <OperationalAlerts />
          </div>
          {children}
        </div>
      </main>

      <button
        onClick={toggleScrollPos}
        className="hidden md:flex fixed bottom-8 right-6 z-[90] w-12 h-12 bg-mynavy dark:bg-myamber text-white dark:text-black rounded-full shadow-2xl border-2 border-white/20 items-center justify-center hover:scale-110 transition-all duration-300"
        aria-label="Toggle scroll position"
      >
        {atBottom ? "↑" : "↓"}
      </button>

      {showExpenseModal ? (
        <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 w-full max-w-sm rounded-2xl shadow-2xl p-6 border-l-4 border-red-500">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-white">Log Burn Rate</h3>
              <button onClick={() => setShowExpenseModal(false)} className="text-gray-400 hover:text-white">x</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">Expense Type</label>
                <select
                  value={expenseForm.type}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, type: e.target.value }))}
                  className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 outline-none"
                >
                  <option value="Fuel">Fuel</option>
                  <option value="Airtime">Data / Airtime</option>
                  <option value="Maintenance">Repair / Maintenance</option>
                  <option value="Misc">Miscellaneous</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">Amount (GHS)</label>
                <input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full p-3 rounded-lg bg-gray-800 text-white font-mono text-xl border border-gray-700 focus:border-red-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">Note (Optional)</label>
                <input
                  type="text"
                  value={expenseForm.note}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, note: e.target.value }))}
                  className="w-full p-3 rounded-lg bg-gray-800 text-white text-sm border border-gray-700 outline-none"
                />
              </div>
            </div>
            <button
              onClick={submitExpense}
              className="w-full mt-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95"
            >
              Confirm Spend
            </button>
          </div>
        </div>
      ) : null}

      {showRateModal ? (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-lg border-t-4 border-green-500 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-bold text-lg dark:text-white">Global Rate Card</h3>
                <p className="text-[10px] text-gray-500">Manage Air, Sea, and Cross-Border Road rates.</p>
              </div>
              <button onClick={() => setShowRateModal(false)} className="text-gray-400 hover:text-red-500">x</button>
            </div>

            <div className="space-y-4">
              <div className="bg-mynavy/5 p-3 rounded-lg border border-mynavy/10 flex justify-between items-center">
                <label className="text-xs font-bold text-gray-500 uppercase">USD Exchange (1 $)</label>
                <div className="relative w-32">
                  <span className="absolute left-3 top-2 text-gray-400 text-xs font-bold">GHS</span>
                  <input
                    type="number"
                    step="0.01"
                    value={rateForm.fx}
                    onChange={(e) => setRateForm((prev) => ({ ...prev, fx: e.target.value }))}
                    className="w-full pl-10 p-1.5 rounded border bg-white dark:bg-black dark:border-gray-700 dark:text-white font-mono font-bold focus:border-green-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 block mb-1">Air ($/kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={rateForm.air}
                    onChange={(e) => setRateForm((prev) => ({ ...prev, air: e.target.value }))}
                    className="w-full p-2 rounded border bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 block mb-1">Sea ($/kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={rateForm.sea}
                    onChange={(e) => setRateForm((prev) => ({ ...prev, sea: e.target.value }))}
                    className="w-full p-2 rounded border bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white font-mono text-xs"
                  />
                </div>
              </div>

              <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-200 dark:border-orange-800">
                <h4 className="text-xs font-bold text-myamber uppercase mb-3">Cross-Border Trucking (GHS)</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[9px] text-gray-500 block mb-1">Fuel/Km</label>
                    <input
                      type="number"
                      step="0.1"
                      value={rateForm.roadKm}
                      onChange={(e) => setRateForm((prev) => ({ ...prev, roadKm: e.target.value }))}
                      className="w-full p-2 rounded border border-orange-200 dark:border-orange-900 bg-white dark:bg-black dark:text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-500 block mb-1">Driver Base</label>
                    <input
                      type="number"
                      step="10"
                      value={rateForm.roadBase}
                      onChange={(e) => setRateForm((prev) => ({ ...prev, roadBase: e.target.value }))}
                      className="w-full p-2 rounded border border-orange-200 dark:border-orange-900 bg-white dark:bg-black dark:text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-500 block mb-1">Border Fee</label>
                    <input
                      type="number"
                      step="10"
                      value={rateForm.border}
                      onChange={(e) => setRateForm((prev) => ({ ...prev, border: e.target.value }))}
                      className="w-full p-2 rounded border border-orange-200 dark:border-orange-900 bg-white dark:bg-black dark:text-white font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg flex justify-between items-center">
                <label className="text-xs font-bold text-gray-500">Local Origin Costs</label>
                <input
                  type="number"
                  step="1"
                  value={rateForm.local}
                  onChange={(e) => setRateForm((prev) => ({ ...prev, local: e.target.value }))}
                  className="w-24 p-1.5 rounded border bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={saveRateCard}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg"
              >
                Save Rates
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showMaintenanceModal ? (
        <div className="fixed inset-0 z-[140] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 w-full max-w-sm rounded-2xl shadow-2xl p-6 border-l-4 border-orange-500">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-white">Record Maintenance</h3>
              <button onClick={() => setShowMaintenanceModal(false)} className="text-gray-400 hover:text-white">x</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">Asset Category</label>
                <select
                  value={maintForm.category}
                  onChange={(e) => setMaintForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 outline-none"
                >
                  <option value="Hub">Hub / Infrastructure</option>
                  <option value="Bike">Fleet: Bike</option>
                  <option value="Van">Fleet: Van</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">Specific Asset</label>
                <input
                  value={maintForm.assetId}
                  onChange={(e) => setMaintForm((prev) => ({ ...prev, assetId: e.target.value }))}
                  className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">Actual Repair Cost (GHS)</label>
                <input
                  type="number"
                  value={maintForm.cost}
                  onChange={(e) => setMaintForm((prev) => ({ ...prev, cost: e.target.value }))}
                  className="w-full p-3 rounded-lg bg-gray-800 text-white font-mono text-xl border border-gray-700 focus:border-orange-500 outline-none"
                />
              </div>

              <label className="flex items-center gap-3 p-3 bg-orange-950/20 border border-orange-900/30 rounded-lg text-xs text-orange-200">
                <input
                  type="checkbox"
                  checked={maintForm.lockInWorkshop}
                  onChange={(e) => setMaintForm((prev) => ({ ...prev, lockInWorkshop: e.target.checked }))}
                  className="w-5 h-5 text-orange-600 rounded cursor-pointer"
                />
                Lock asset in Workshop? (Unusable)
              </label>
            </div>

            <button
              onClick={submitMaintenance}
              className="w-full mt-8 py-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95"
            >
              Deduct and Log Repair
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}


