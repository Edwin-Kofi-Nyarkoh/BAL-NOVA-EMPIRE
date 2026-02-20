// app/pro_portal/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Briefcase,
  MessageCircle,
  Users,
  Settings,
  Menu,
  Sun,
  Moon,
  Trophy,
  ClipboardList,
  WandSparkles,
  BarChart3,
  Plus,
  Coins,
  Bolt,
  Shield
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { getJSON, postJSON, requestJSON } from "@/lib/sync"
import { LogoutButton } from "@/components/logout-button"
import { useDialog } from "@/components/ui/dialog-service"

type Job = {
  id: string
  title: string
  budget: number
  location: string
  createdAt?: string
  acceptedAt?: string | null
  status?: string
}

type Chat = {
  id: string
  role: "user" | "ai"
  text: string
  createdAt: string
}

type Portfolio = {
  summary: string
}

type TeamMember = {
  id?: string
  name: string
  role: string
}

type WalletEntry = {
  id: string
  desc: string
  amount: number
  createdAt: string
  type: string
}

type TabKey = "dashboard" | "market" | "chats" | "portfolio" | "wallet" | "team" | "settings"

type Toast = { id: string; message: string; tone: "success" | "error" }

export default function ProPortalPage() {
  const dialog = useDialog()
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [marketJobs, setMarketJobs] = useState<Job[]>([])
  const [chats, setChats] = useState<Chat[]>([])
  const [portfolio, setPortfolio] = useState<Portfolio>({ summary: "" })
  const [team, setTeam] = useState<TeamMember[]>([])
  const [tier, setTier] = useState<number>(1)
  const [apiKey, setApiKey] = useState("")
  const [autoChat, setAutoChat] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [aiInsights, setAiInsights] = useState("")
  const [aiReplies, setAiReplies] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [credits, setCredits] = useState(0)
  const [walletEntries, setWalletEntries] = useState<WalletEntry[]>([])
  const [toastQueue, setToastQueue] = useState<Toast[]>([])
  const [showTopup, setShowTopup] = useState(false)
  const [topupAmount, setTopupAmount] = useState("")

  useEffect(() => {
    const dark = localStorage.getItem("svc_theme") === "dark"
    setIsDark(dark)
    document.documentElement.classList.toggle("dark", dark)

    void syncChats()
    void syncJobs()
    void syncPortfolio()
    void syncTeam()
    void syncSettings()
    void syncWallet()
  }, [])

  function pushToast(message: string, tone: "success" | "error" = "success") {
    const id = `toast-${Date.now()}`
    setToastQueue((prev) => [...prev, { id, message, tone }])
    setTimeout(() => {
      setToastQueue((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }

  async function syncChats() {
    const data = await getJSON<{ chats: Chat[] }>("/api/chats", { chats: [] })
    setChats(Array.isArray(data.chats) ? data.chats : [])
  }

  async function syncJobs() {
    const data = await getJSON<{ orders: { id: string; item: string; price: number; origin?: string | null; createdAt: string; status?: string }[] }>("/api/orders", { orders: [] })
    const jobs = (Array.isArray(data.orders) ? data.orders : []).map((o) => ({
      id: o.id,
      title: o.item,
      budget: o.price,
      location: o.origin || "Accra",
      createdAt: o.createdAt,
      acceptedAt: (o as any).acceptedAt || null,
      status: o.status || "Pending"
    }))
    setMarketJobs(jobs)
  }

  async function syncPortfolio() {
    const data = await getJSON<{ portfolio?: { summary: string } | null }>("/api/pro/portfolio", {})
    if (data.portfolio) setPortfolio({ summary: data.portfolio.summary })
  }

  async function syncTeam() {
    const data = await getJSON<{ team?: { id: string; name: string; role: string }[] }>("/api/pro/team", {})
    setTeam(Array.isArray(data.team) ? data.team : [])
  }

  async function syncSettings() {
    const data = await getJSON<{ settings?: { apiKey?: string; proTier?: number; theme?: string; autoChat?: boolean } }>("/api/settings", {})
    if (data.settings?.apiKey) setApiKey(data.settings.apiKey)
    if (typeof data.settings?.proTier === "number") setTier(data.settings.proTier)
    if (typeof data.settings?.autoChat === "boolean") setAutoChat(data.settings.autoChat)
    if (data.settings?.theme) {
      const dark = data.settings.theme === "dark"
      setIsDark(dark)
      document.documentElement.classList.toggle("dark", dark)
    }
  }

  async function syncWallet() {
    const data = await getJSON<{ credits?: number; entries?: { id: string; amount: number; type: string; note?: string | null; createdAt: string }[] }>(
      "/api/pro/wallet",
      { credits: 0, entries: [] }
    )
    setCredits(Number(data.credits || 0))
    const mapped = (Array.isArray(data.entries) ? data.entries : []).map((entry) => ({
      id: entry.id,
      desc: entry.note || entry.type,
      amount: Number(entry.amount || 0),
      createdAt: entry.createdAt,
      type: entry.type
    }))
    setWalletEntries(mapped)
  }

  const earnings = useMemo(() => marketJobs.reduce((sum, j) => sum + j.budget, 0), [marketJobs])
  const jobsWon = useMemo(() => marketJobs.filter((j) => j.status === "Delivered" || j.status === "Paid").length, [marketJobs])

  const hotZoneStats = useMemo<{
    mostOrders: { loc: string; value: number } | null
    highestRevenue: { loc: string; value: number } | null
    fastestAcceptance: { loc: string; valueMs: number } | null
  }>(() => {
    const stats = new Map<
      string,
      { count: number; revenue: number; acceptTotalMs: number; acceptCount: number }
    >()

    for (const job of marketJobs) {
      const loc = job.location || "Unknown"
      const current = stats.get(loc) || { count: 0, revenue: 0, acceptTotalMs: 0, acceptCount: 0 }
      current.count += 1
      current.revenue += Number(job.budget || 0)

      if (job.acceptedAt && job.createdAt) {
        const diff = new Date(job.acceptedAt).getTime() - new Date(job.createdAt).getTime()
        if (Number.isFinite(diff) && diff >= 0) {
          current.acceptTotalMs += diff
          current.acceptCount += 1
        }
      }

      stats.set(loc, current)
    }

    let mostOrders: { loc: string; value: number } | null = null
    let highestRevenue: { loc: string; value: number } | null = null
    let fastestAcceptance: { loc: string; valueMs: number } | null = null

    stats.forEach((value, loc) => {
      if (!mostOrders || value.count > mostOrders.value) {
        mostOrders = { loc, value: value.count }
      }
      if (!highestRevenue || value.revenue > highestRevenue.value) {
        highestRevenue = { loc, value: value.revenue }
      }
      if (value.acceptCount > 0) {
        const avg = value.acceptTotalMs / value.acceptCount
        if (!fastestAcceptance || avg < fastestAcceptance.valueMs) {
          fastestAcceptance = { loc, valueMs: avg }
        }
      }
    })

    return { mostOrders, highestRevenue, fastestAcceptance }
  }, [marketJobs])

  const weeklyBars = useMemo(() => {
    const days = 7
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - (days - 1))
    const counts = new Array(days).fill(0)
    for (const job of marketJobs) {
      if (!job.createdAt) continue
      const d = new Date(job.createdAt)
      const index = Math.floor((d.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
      if (index >= 0 && index < days) counts[index] += 1
    }
    return counts
  }, [marketJobs])

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("svc_theme", next ? "dark" : "light")
    void requestJSON("/api/settings", { theme: next ? "dark" : "light" }, "PUT", {})
  }

  function sendChat(text: string) {
    if (!text.trim()) return
    const newMsg: Chat = { id: `C-${Date.now()}`, role: "user", text, createdAt: new Date().toISOString() }
    setChats((prev) => [...prev, newMsg])
    void postJSON("/api/chats", { chat: newMsg }, { chats: [] })
  }

  async function addTeamMember() {
    const name = await dialog.prompt("Team member name", { placeholder: "Team member name" })
    if (!name) return
    const role = (await dialog.prompt("Role", { placeholder: "Associate", defaultValue: "Associate" })) || "Associate"
    void postJSON("/api/pro/team", { name, role }, {}).then(() => syncTeam())
  }

  function removeTeamMember(id: string) {
    void requestJSON(`/api/pro/team/${id}`, {}, "DELETE", {}).then(() => syncTeam())
  }

  async function generateInsights() {
    if (!apiKey) return
    setAiLoading(true)
    try {
      const jobContext = marketJobs.map((j) => j.title).join(", ")
      const prompt = `Give 3 short strategy tips for a service pro. Jobs: ${jobContext || "none"}.`
      const text = await callGemini(apiKey, prompt)
      setAiInsights(text)
    } finally {
      setAiLoading(false)
    }
  }

  async function generateReplies() {
    if (!apiKey) return
    setAiLoading(true)
    try {
      const lastMsg = chats[chats.length - 1]?.text || "Can you help me?"
      const prompt = `Suggest 3 short replies to: "${lastMsg}". Format: Reply1 | Reply2 | Reply3`
      const text = await callGemini(apiKey, prompt)
      setAiReplies(text)
    } finally {
      setAiLoading(false)
    }
  }

  async function acceptJob(jobId: string) {
    const res = await requestJSON<{ order?: { status: string; acceptedAt?: string | null } }>(
      `/api/orders/${jobId}`,
      { status: "Accepted" },
      "PATCH",
      {}
    )
    if (res?.order) {
      setMarketJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: res.order?.status, acceptedAt: res.order?.acceptedAt || null } : j)))
      pushToast("Job accepted")
      return
    }
    pushToast("Unable to accept job.", "error")
  }

  function simulateDirectLead() {
    const newJob: Job = {
      id: `DIR-${Date.now()}`,
      title: "Direct Lead: AC Repair",
      budget: 120,
      location: "Phone Contact",
      createdAt: new Date().toISOString(),
      status: "Open"
    }
    setMarketJobs((prev) => [newJob, ...prev])
    pushToast("Direct lead received")
    setActiveTab("market")
  }

  async function buyCredits() {
    const amount = Number(topupAmount)
    if (!amount || amount < 1) {
      pushToast("Enter a valid amount.", "error")
      return
    }
    const res = await requestJSON<{ link?: string }>(
      "/api/pro/credits/checkout",
      { amount },
      "POST",
      {}
    )
    if (res?.link) {
      setShowTopup(false)
      setTopupAmount("")
      window.location.href = res.link
      return
    }
    pushToast("Unable to start Paystack checkout.", "error")
  }

  async function importLegacyProData() {
    const legacyPortfolio = safeParse<Portfolio>("svc_portfolio", { summary: "" })
    const legacyTeam = safeParse<TeamMember[]>("balnova_service_team", [])
    const legacyTier = parseInt(localStorage.getItem("svc_tier") || "1", 10)
    const legacyApiKey = localStorage.getItem("gemini_api_key") || ""
    const legacyTheme = localStorage.getItem("svc_theme") || ""
    const legacyAutoChat = localStorage.getItem("svc_auto_chat") === "true"

    if (legacyPortfolio.summary) {
      await requestJSON("/api/pro/portfolio", { summary: legacyPortfolio.summary }, "PUT", {})
    }

    await requestJSON(
      "/api/settings",
      { apiKey: legacyApiKey || "", proTier: legacyTier, theme: legacyTheme || "", autoChat: legacyAutoChat },
      "PUT",
      {}
    )

    for (const member of legacyTeam) {
      if (member?.name) {
        await postJSON("/api/pro/team", { name: member.name, role: member.role || "Associate" }, {})
      }
    }

    await syncPortfolio()
    await syncTeam()
    await syncSettings()
    pushToast("Legacy data imported")
  }

  const navItems: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: "Dashboard", icon: <BarChart3 className="w-4 h-4" /> },
    { key: "market", label: "Job Market", icon: <Briefcase className="w-4 h-4" /> },
    { key: "chats", label: "My Jobs", icon: <MessageCircle className="w-4 h-4" /> },
    { key: "team", label: "My Team", icon: <Users className="w-4 h-4" /> },
    { key: "portfolio", label: "Portfolio", icon: <Trophy className="w-4 h-4" /> },
    { key: "wallet", label: "Credit Wallet", icon: <Coins className="w-4 h-4" /> },
    { key: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> }
  ]

  return (
    <div className="bg-gray-50 text-gray-800 dark:bg-mydark dark:text-gray-100 overflow-hidden h-screen flex">
      <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        {toastQueue.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "px-4 py-3 rounded-lg shadow-lg text-white text-sm font-semibold",
              toast.tone === "success" ? "bg-mynavy" : "bg-red-600"
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 transform w-64 bg-mynavy text-white flex flex-col transition-transform duration-300 z-50 shadow-xl border-r border-white/10",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="p-6 flex flex-col items-center border-b border-white/10">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-3 border-2 border-emerald-400 relative">
            <Shield className="w-7 h-7 text-emerald-400" />
            <div className="absolute -top-1 -right-1 bg-emerald-400 text-mynavy text-[9px] font-bold px-2 py-0.5 rounded-full">
              {tier === 1 ? "APP." : tier === 2 ? "EXPERT" : "AGENCY"}
            </div>
          </div>
          <h1 className="font-bold text-xl tracking-wide">BAL NOVA</h1>
          <p className="text-xs text-emerald-300/90">Service Provider</p>
          <div className="text-xs text-gray-300 mt-2">Credits: {credits}</div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setActiveTab(item.key)
                setSidebarOpen(false)
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors text-left text-gray-300 hover:text-white group",
                activeTab === item.key && "bg-white/10 text-white"
              )}
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div
        className={cn("fixed inset-0 bg-black/50 z-40 md:hidden", sidebarOpen ? "block" : "hidden")}
        onClick={() => setSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative pt-16 md:pt-0 md:ml-64">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-16 flex items-center justify-between px-6 shrink-0 transition-colors">
          <div className="flex items-center">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-500 mr-4" aria-label="Open sidebar">
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-mynavy dark:text-white">
              {navItems.find((n) => n.key === activeTab)?.label || "Pro Portal"}
            </h2>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <button
              onClick={simulateDirectLead}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors text-xs font-bold border border-purple-200"
            >
              <Bolt className="w-3 h-3" /> Simulate Direct Lead
            </button>
            <div className="bg-emerald-500/10 text-emerald-500 px-4 py-1.5 rounded-full font-bold text-sm border border-emerald-500/20 flex items-center gap-2">
              <Coins className="w-4 h-4" /> {credits} Credits
            </div>
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors text-gray-600 dark:text-myamber"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <LogoutButton className="inline-flex text-xs font-bold px-3 py-2 rounded-full border border-myamber/30 text-myamber hover:bg-myamber/10 transition-colors" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          {activeTab === "dashboard" ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border-l-4 border-emerald-500">
                  <div className="text-xs font-semibold text-gray-400 uppercase">Available Credits</div>
                  <div className="text-3xl font-black text-mynavy dark:text-white mt-1">{credits}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border-l-4 border-blue-600">
                  <div className="text-xs font-semibold text-gray-400 uppercase">Jobs Won</div>
                  <div className="text-3xl font-black text-mynavy dark:text-white mt-1">{jobsWon}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border-l-4 border-purple-500">
                  <div className="text-xs font-semibold text-gray-400 uppercase">Market Jobs</div>
                  <div className="text-3xl font-black text-mynavy dark:text-white mt-1">{marketJobs.length}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="text-xs font-semibold text-gray-400 uppercase">Most Orders Zone</div>
                  <div className="text-lg font-bold text-mynavy dark:text-white mt-1">
                    {hotZoneStats.mostOrders ? hotZoneStats.mostOrders.loc : "No data"}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {hotZoneStats.mostOrders ? `${hotZoneStats.mostOrders.value} orders` : " "}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="text-xs font-semibold text-gray-400 uppercase">Highest Revenue Zone</div>
                  <div className="text-lg font-bold text-mynavy dark:text-white mt-1">
                    {hotZoneStats.highestRevenue ? hotZoneStats.highestRevenue.loc : "No data"}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {hotZoneStats.highestRevenue ? formatCurrency(hotZoneStats.highestRevenue.value) : " "}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="text-xs font-semibold text-gray-400 uppercase">Fastest Acceptance Zone</div>
                  <div className="text-lg font-bold text-mynavy dark:text-white mt-1">
                    {hotZoneStats.fastestAcceptance ? hotZoneStats.fastestAcceptance.loc : "No data"}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {hotZoneStats.fastestAcceptance ? formatDuration(hotZoneStats.fastestAcceptance.valueMs) : " "}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold dark:text-white">Leads Performance</h3>
                      <p className="text-xs text-gray-400">Weekly activity</p>
                    </div>
                    <button
                      onClick={generateInsights}
                      className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-xs font-bold border border-gray-200 dark:border-white/10 transition-colors"
                    >
                      {aiLoading ? "Generating..." : "Generate"}
                    </button>
                  </div>
                  <div className="bg-black/5 dark:bg-black/20 p-4 rounded-lg text-sm leading-relaxed min-h-[80px]">
                    {aiInsights || "Click Generate to analyze the market."}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase mb-3">
                    <BarChart3 className="w-4 h-4" /> Weekly Jobs Won
                  </div>
                  <div className="grid grid-cols-7 gap-2 items-end h-32">
                    {weeklyBars.map((v, i) => (
                      <div key={i} className="bg-myamber/70 rounded-sm" style={{ height: `${Math.max(6, v * 12)}px` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "market" ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg dark:text-white">Open Jobs Nearby</h3>
                <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded">Live Feed</span>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl mb-4 text-xs text-blue-800 dark:text-blue-200">
                Direct requests are highlighted in purple. 10 Credits = 1 Lead.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {marketJobs.length === 0 ? (
                  <div className="text-sm text-gray-500">No jobs yet.</div>
                ) : (
                  marketJobs.map((j) => (
                    <div key={j.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                      <div className="font-bold">{j.title}</div>
                      <div className="text-xs text-gray-400">{j.location}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm text-myamber font-bold">{formatCurrency(j.budget)}</span>
                        <span
                          className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded-full",
                            j.status === "Paid" || j.status === "Delivered"
                              ? "bg-emerald-500/15 text-emerald-600"
                              : "bg-amber-500/15 text-amber-600"
                          )}
                        >
                          {j.status}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => acceptJob(j.id)}
                          className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-200 hover:bg-emerald-500/20"
                        >
                          Accept
                        </button>
                        {j.acceptedAt ? (
                          <span className="text-[10px] text-gray-400">Accepted {new Date(j.acceptedAt).toLocaleString()}</span>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "chats" ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg dark:text-white">My Jobs</h3>
                <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border", tier >= 3 ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-gray-100 text-gray-500 border-gray-200")}
                >
                  <span className="text-xs font-bold">Auto-Reply</span>
                  <button
                    onClick={() => {
                      const next = !autoChat
                      setAutoChat(next)
                      void requestJSON("/api/settings", { autoChat: next }, "PUT", {})
                    }}
                    className={cn(
                      "w-9 h-5 rounded-full relative transition",
                      autoChat ? "bg-emerald-500" : "bg-gray-300"
                    )}
                    aria-label="Toggle auto reply"
                  >
                    <span
                      className={cn(
                        "w-4 h-4 rounded-full bg-white absolute top-0.5 transition",
                        autoChat ? "right-0.5" : "left-0.5"
                      )}
                    />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700 font-bold dark:text-white">
                    Active Messages
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                    {chats.length === 0 ? (
                      <div className="p-4 text-gray-400 text-sm text-center">No messages yet.</div>
                    ) : (
                      chats.map((c) => (
                        <div key={c.id} className="p-4 text-sm">
                          <div className="font-bold truncate">{c.text}</div>
                          <div className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString()}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                    <div>
                      <h3 className="font-bold text-mynavy dark:text-white">Messages</h3>
                      <p className="text-xs text-gray-500">Synced from customer chats</p>
                    </div>
                    <button
                      onClick={generateReplies}
                      className="text-xs bg-myamber/20 text-myamber px-3 py-1.5 rounded font-bold"
                    >
                      {aiLoading ? "Generating..." : "AI Suggestions"}
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 flex flex-col space-y-2 bg-slate-50 dark:bg-gray-900/50">
                    {chats.length === 0 ? (
                      <div className="text-center text-xs text-gray-400 mt-4">Start the conversation...</div>
                    ) : (
                      chats.map((c) => (
                        <div key={c.id} className={cn("chat-bubble", c.role === "user" ? "chat-user" : "chat-ai")}>
                          {c.text}
                        </div>
                      ))
                    )}
                  </div>

                  {aiReplies ? (
                    <div className="px-4 py-2 bg-white dark:bg-gray-800 border-t dark:border-gray-700 text-xs text-gray-500">
                      {aiReplies}
                    </div>
                  ) : null}

                  <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <ChatInput onSend={sendChat} />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "portfolio" ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 max-w-3xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-xl dark:text-white">Professional Portfolio</h3>
                <button
                  onClick={() => requestJSON("/api/pro/portfolio", { summary: portfolio.summary }, "PUT", {})}
                  className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold shadow"
                >
                  Save and Publish
                </button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Bio</label>
                  <textarea
                    value={portfolio.summary}
                    onChange={(e) => setPortfolio({ summary: e.target.value })}
                    rows={4}
                    className="w-full p-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "wallet" ? (
            <div className="space-y-6 max-w-3xl">
              <div className="bg-gradient-to-r from-[#0A2342] to-[#FFBF00] rounded-xl p-6 text-white shadow-lg">
                <h2 className="text-4xl font-black mb-4">{credits} Pts</h2>
                <button
                  onClick={() => setShowTopup(true)}
                  className="bg-white text-mynavy px-4 py-2 rounded-lg font-bold text-sm"
                >
                  Top Up (GHS)
                </button>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                <h3 className="font-bold mb-4 dark:text-white">History</h3>
                <div className="space-y-2">
                  {walletEntries.length === 0 ? (
                    <div className="text-sm text-gray-500">No history yet.</div>
                  ) : (
                    walletEntries.map((h) => (
                      <div key={h.id} className="flex justify-between text-sm py-2 border-b dark:border-gray-700">
                        <div>
                          <div>{h.desc}</div>
                          <div className="text-[10px] text-gray-400">{new Date(h.createdAt).toLocaleString()}</div>
                        </div>
                        <span className={cn("font-mono", h.amount >= 0 ? "text-emerald-500" : "text-red-500")}>
                          {formatCurrency(Math.abs(h.amount))}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "team" ? (
            <div className="space-y-4 max-w-3xl">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-xl dark:text-white">Agency Team</h3>
                  <p className="text-xs text-gray-500">Manage your sub-accounts and junior pros.</p>
                </div>
                <button
                  onClick={addTeamMember}
                  className="bg-mynavy text-white px-4 py-2 rounded-lg font-bold shadow text-sm hover:bg-myblue"
                >
                  <Plus className="w-4 h-4 inline-block mr-2" /> Add Agent
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {team.length === 0 ? (
                  <div className="col-span-full text-center text-gray-400 py-10">No agents yet. Add one to start scaling.</div>
                ) : (
                  team.map((member) => (
                    <div key={member.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-mynavy rounded-full text-white flex items-center justify-center font-bold">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold dark:text-white">{member.name}</h4>
                          <p className="text-xs text-gray-500">{member.role}</p>
                        </div>
                      </div>
                      <button onClick={() => removeTeamMember(member.id || "")} className="text-red-500 hover:text-red-700">Remove</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "settings" ? (
            <div className="space-y-4 max-w-xl">
              <div className="bg-emerald-500/10 p-6 rounded-xl border border-emerald-500/30">
                <h3 className="font-bold text-mynavy dark:text-white mb-2">Simulation: Switch Tier</h3>
                <div className="flex gap-2">
                  {[1, 2, 3].map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setTier(t)
                        void requestJSON("/api/settings", { proTier: t }, "PUT", {})
                      }}
                      className={cn(
                        "flex-1 py-2 bg-white dark:bg-gray-800 border border-emerald-500/20 rounded shadow-sm text-sm",
                        tier === t && "bg-emerald-500 text-white"
                      )}
                    >
                      Tier {t}
                    </button>
                  ))}
                </div>
              </div>

              <label className="text-xs font-bold text-gray-500">Gemini API Key</label>
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full p-2 rounded border dark:bg-gray-900 dark:border-gray-700"
              />
              <button
                onClick={() => requestJSON("/api/settings", { apiKey }, "PUT", {})}
                className="text-xs font-bold bg-myamber text-myblue px-3 py-2 rounded"
              >
                Save API Key
              </button>
              <button
                onClick={importLegacyProData}
                className="text-xs font-bold bg-gray-100 text-gray-700 px-3 py-2 rounded"
              >
                Import Legacy Local Data
              </button>
              <label className="text-xs font-bold text-gray-500">Auto Chat</label>
              <button
                onClick={() => {
                  const next = !autoChat
                  setAutoChat(next)
                  void requestJSON("/api/settings", { autoChat: next }, "PUT", {})
                }}
                className={cn(
                  "px-3 py-2 rounded text-xs font-bold border",
                  autoChat ? "bg-green-100 text-green-700 border-green-200" : "border-gray-200 dark:border-gray-700"
                )}
              >
                {autoChat ? "Enabled" : "Disabled"}
              </button>
            </div>
          ) : null}
        </div>
      </main>

      {showTopup ? (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg dark:text-white">Top Up Wallet</h3>
              <button onClick={() => setShowTopup(false)} className="text-gray-400 text-xl">x</button>
            </div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Amount (GHS)</label>
            <input
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
              type="number"
              min="1"
              placeholder="e.g. 50"
              className="w-full p-3 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[20, 50, 100].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setTopupAmount(String(amt))}
                  className="py-2 rounded-lg border text-xs font-bold border-gray-200 dark:border-gray-700"
                >
                  {amt}
                </button>
              ))}
            </div>
            <button
              onClick={buyCredits}
              className="w-full mt-4 bg-mynavy text-white py-3 rounded-xl font-bold"
            >
              Continue to Paystack
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ChatInput({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState("")
  return (
    <div className="flex gap-2">
      <input
        className="flex-1 p-3 rounded-lg border dark:bg-gray-800 dark:border-gray-700"
        placeholder="Type a message..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        onClick={() => {
          onSend(text)
          setText("")
        }}
        className="px-4 rounded-lg bg-mynavy text-white"
      >
        <MessageCircle className="h-4 w-4" />
      </button>
    </div>
  )
}

function safeParse<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000))
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${minutes}m`
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
