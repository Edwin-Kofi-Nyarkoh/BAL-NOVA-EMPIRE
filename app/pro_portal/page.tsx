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
  Plus
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { getJSON, postJSON, requestJSON } from "@/lib/sync"
import { LogoutButton } from "@/components/logout-button"

type Job = {
  id: string
  title: string
  budget: number
  location: string
  createdAt?: string
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

type TabKey = "dashboard" | "jobs" | "chats" | "portfolio" | "team" | "settings"

export default function ProPortalPage() {
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

  useEffect(() => {

    const dark = localStorage.getItem("svc_theme") === "dark"
    setIsDark(dark)
    document.documentElement.classList.toggle("dark", dark)

    void syncChats()
    void syncJobs()
    void syncPortfolio()
    void syncTeam()
    void syncSettings()
  }, [])


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

  const earnings = useMemo(() => marketJobs.reduce((sum, j) => sum + j.budget, 0), [marketJobs])
  const points = useMemo(() => marketJobs.length * 5, [marketJobs])

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

  function addTeamMember() {
    const name = prompt("Team member name") || ""
    if (!name) return
    const role = prompt("Role") || "Associate"
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
  }

  const navItems: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: "Dashboard", icon: <Briefcase className="w-4 h-4" /> },
    { key: "jobs", label: "Jobs Market", icon: <ClipboardList className="w-4 h-4" /> },
    { key: "chats", label: "Messages", icon: <MessageCircle className="w-4 h-4" /> },
    { key: "portfolio", label: "Portfolio", icon: <Trophy className="w-4 h-4" /> },
    { key: "team", label: "Team", icon: <Users className="w-4 h-4" /> },
    { key: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> }
  ]

  return (
    <div className="bg-white text-gray-800 dark:bg-mydark dark:text-gray-100 overflow-hidden h-screen flex">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-64 bg-myblue text-white flex flex-col transition-transform duration-300 z-50 shadow-xl border-r border-white/10",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="p-6 flex flex-col items-center border-b border-white/10">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-3 border-2 border-myamber">
            <Users className="text-myamber w-8 h-8" />
          </div>
          <h1 className="font-bold text-xl tracking-wide">PRO PORTAL</h1>
          <p className="text-xs text-myamber/80 mb-3">Tier {tier}</p>
          <div className="text-xs text-gray-300">Points: {points}</div>
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
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-500 mr-4">
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-myblue dark:text-white">
              {navItems.find((n) => n.key === activeTab)?.label || "Pro Portal"}
            </h2>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors text-myblue dark:text-myamber"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <LogoutButton className="hidden md:inline-flex text-xs font-bold px-3 py-2 rounded-full border border-myamber/30 text-myamber hover:bg-myamber/10 transition-colors" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          {activeTab === "dashboard" ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                  <div className="text-xs text-gray-400 uppercase">Points</div>
                  <div className="text-2xl font-bold">{points}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                  <div className="text-xs text-gray-400 uppercase">Total Earnings</div>
                  <div className="text-2xl font-bold">{formatCurrency(earnings)}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                  <div className="text-xs text-gray-400 uppercase">Market Jobs</div>
                  <div className="text-2xl font-bold">{marketJobs.length}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-gradient-to-r from-myblue to-blue-900 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-myamber flex items-center gap-2">
                          <WandSparkles className="w-4 h-4" /> Pro Advisor AI
                        </h3>
                        <p className="text-blue-200 text-sm">Market insights and strategy.</p>
                      </div>
                      <button
                        onClick={generateInsights}
                        className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-bold border border-white/20 transition-colors"
                      >
                        {aiLoading ? "Generating..." : "Generate"}
                      </button>
                    </div>
                    <div className="bg-black/20 p-4 rounded-lg text-sm leading-relaxed min-h-[60px]">
                      {aiInsights || "Click Generate to analyze the market."}
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase mb-3">
                    <BarChart3 className="w-4 h-4" /> Weekly Jobs Won
                  </div>
                  <div className="grid grid-cols-7 gap-2 items-end h-32">
                    {weeklyBars.map((v, i) => (
                      <div key={i} className="bg-myamber/70 rounded-sm" style={{ height: `${v * 12}px` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "jobs" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Jobs Market</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {marketJobs.map((j) => (
                  <div key={j.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <div className="font-bold">{j.title}</div>
                    <div className="text-xs text-gray-400">{j.location}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-myamber font-bold">{formatCurrency(j.budget)}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                          j.status === "Paid" || j.status === "Delivered"
                            ? "bg-emerald-500/15 text-emerald-600"
                            : "bg-amber-500/15 text-amber-600"
                        }`}
                      >
                        {j.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === "chats" ? (
            <div className="max-w-lg">
              <h3 className="text-lg font-bold mb-3">Messages</h3>
              <div className="space-y-2 mb-4">
                {chats.length === 0 ? (
                  <div className="text-sm text-gray-500">No messages yet.</div>
                ) : (
                  chats.map((c) => (
                    <div key={c.id} className={cn("chat-bubble", c.role === "user" ? "chat-user" : "chat-ai")}>
                      {c.text}
                    </div>
                  ))
                )}
              </div>
              <ChatInput onSend={sendChat} />
              <div className="mt-4">
                <button
                  onClick={generateReplies}
                  className="text-xs font-bold bg-myamber text-myblue px-3 py-2 rounded"
                >
                  {aiLoading ? "Generating..." : "Generate Smart Replies"}
                </button>
                {aiReplies ? (
                  <div className="text-xs text-gray-500 dark:text-gray-300 mt-2">{aiReplies}</div>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeTab === "portfolio" ? (
            <div className="max-w-xl">
              <h3 className="text-lg font-bold mb-3">Portfolio</h3>
              <textarea
                value={portfolio.summary}
                onChange={(e) => setPortfolio({ summary: e.target.value })}
                className="w-full p-3 rounded border dark:bg-gray-900 dark:border-gray-700"
                rows={4}
              />
              {portfolio.summary.trim().length === 0 ? (
                <p className="text-xs text-gray-500 mt-2">Add your portfolio summary here.</p>
              ) : null}
              <button
                onClick={() => requestJSON("/api/pro/portfolio", { summary: portfolio.summary }, "PUT", {})}
                className="mt-3 text-xs font-bold bg-myamber text-myblue px-3 py-2 rounded"
              >
                Save Portfolio
              </button>
            </div>
          ) : null}

          {activeTab === "team" ? (
            <div className="max-w-xl space-y-3">
              <h3 className="text-lg font-bold">Team</h3>
              <button
                onClick={addTeamMember}
                className="text-xs font-bold bg-myamber text-myblue px-3 py-2 rounded"
              >
                <Plus className="w-3 h-3 inline-block mr-1" /> Add Member
              </button>
              {team.length === 0 ? (
                <div className="text-sm text-gray-500">No team yet.</div>
              ) : (
                team.map((t: any) => (
                  <div key={t.id} className="text-sm flex items-center justify-between">
                    <span>{t.name} - {t.role}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const name = prompt("Update name", t.name) || ""
                          if (!name) return
                          const role = prompt("Update role", t.role) || ""
                          void requestJSON(`/api/pro/team/${t.id}`, { name, role }, "PATCH", {}).then(() => syncTeam())
                        }}
                        className="text-xs text-myamber"
                      >
                        Edit
                      </button>
                      <button onClick={() => removeTeamMember(t.id)} className="text-xs text-red-400">Remove</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {activeTab === "settings" ? (
            <div className="max-w-xl space-y-4">
              <h3 className="text-lg font-bold">Settings</h3>
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
              <label className="text-xs font-bold text-gray-500">Tier</label>
              <div className="flex gap-2">
                {[1, 2, 3].map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTier(t)
                      void requestJSON("/api/settings", { proTier: t }, "PUT", {})
                    }}
                    className={cn(
                      "px-3 py-2 rounded text-xs font-bold border",
                      tier === t ? "bg-myamber text-myblue border-myamber" : "border-gray-200 dark:border-gray-700"
                    )}
                  >
                    Tier {t}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}

function ChatInput({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState("")
  return (
    <div className="mt-4 flex gap-2">
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
