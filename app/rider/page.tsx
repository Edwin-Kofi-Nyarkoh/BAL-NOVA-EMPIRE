// app/rider/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bike,
  MapPin,
  Route,
  MessageCircle,
  Menu,
  Sun,
  Moon,
  ShieldCheck,
  AlertTriangle
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { getJSON, requestJSON } from "@/lib/sync"
import { LogoutButton } from "@/components/logout-button"

type Trip = {
  id: string
  route: string
  status: "Pending" | "In-Transit" | "Delivered" | "Delayed"
  eta: string
}

type Mission = {
  id: string
  pickup: string
  dropoff: string
  payout: number
}

type RiderProfile = {
  name: string
  initials: string
}

type TabKey = "dashboard" | "missions" | "map" | "messages" | "settings"

export default function RiderPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [trips, setTrips] = useState<Trip[]>([])
  const [missions, setMissions] = useState<Mission[]>([])
  const [profile, setProfile] = useState<RiderProfile>({ name: "", initials: "" })
  const [messages, setMessages] = useState<{ id: string; text: string }[]>([])
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    void syncMissions()
    void syncTrips()
    void syncProfile()
    void syncMessages()
    void syncSettings()
  }, [])

  async function syncMissions() {
    const data = await getJSON<{ orders: any[] }>("/api/orders", { orders: [] })
    const mapped = (Array.isArray(data.orders) ? data.orders : []).slice(0, 6).map((o) => ({
      id: o.id,
      pickup: o.origin || "Warehouse",
      dropoff: o.item,
      payout: Math.max(10, Math.round((o.price || 0) * 0.1))
    })) as Mission[]
    setMissions(mapped)
  }

  async function syncTrips() {
    const data = await getJSON<{ orders: any[] }>("/api/orders", { orders: [] })
    const mapped = (Array.isArray(data.orders) ? data.orders : []).slice(0, 6).map((o) => ({
      id: o.id,
      route: `${o.origin || "Warehouse"} -> ${o.item}`,
      status: (o.status || "Pending") as Trip["status"],
      eta: new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    })) as Trip[]
    setTrips(mapped)
  }

  async function syncProfile() {
    const data = await getJSON<{ user?: { name?: string | null; email?: string | null } }>("/api/me", {})
    const name = data.user?.name || data.user?.email || "Rider"
    const initials = name
      .split(" ")
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
    setProfile({ name, initials })
  }

  async function syncMessages() {
    const data = await getJSON<{ chats: { id: string; text: string }[] }>("/api/chats", { chats: [] })
    const mapped = (Array.isArray(data.chats) ? data.chats : []).slice(0, 6).map((c) => ({
      id: c.id,
      text: c.text
    }))
    setMessages(mapped)
  }

  async function syncSettings() {
    const data = await getJSON<{ settings?: { theme?: string } }>("/api/settings", {})
    const dark = data.settings?.theme === "dark"
    setIsDark(dark)
    document.documentElement.classList.toggle("dark", dark)
  }

  async function importLegacyRiderData() {
    const legacyTheme = localStorage.getItem("rider_theme") || ""
    await requestJSON("/api/settings", { theme: legacyTheme || "" }, "PUT", {})
    await syncSettings()
  }
  const activeCount = useMemo(() => trips.filter((t) => t.status === "In-Transit").length, [trips])
  const payoutTotal = useMemo(() => missions.reduce((sum, m) => sum + m.payout, 0), [missions])

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("rider_theme", next ? "dark" : "light")
    void requestJSON("/api/settings", { theme: next ? "dark" : "light" }, "PUT", {})
  }

  const navItems: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: "Dashboard", icon: <Bike className="w-4 h-4" /> },
    { key: "missions", label: "Missions", icon: <Route className="w-4 h-4" /> },
    { key: "map", label: "Map", icon: <MapPin className="w-4 h-4" /> },
    { key: "messages", label: "Messages", icon: <MessageCircle className="w-4 h-4" /> },
    { key: "settings", label: "Settings", icon: <ShieldCheck className="w-4 h-4" /> }
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
            <Bike className="text-myamber w-8 h-8" />
          </div>
          <h1 className="font-bold text-xl tracking-wide">{profile.name}</h1>
          <p className="text-xs text-myamber/80 mb-3">Rider Ops</p>
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
              {navItems.find((n) => n.key === activeTab)?.label || "Rider"}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                <div className="text-xs text-gray-400 uppercase">Active Trips</div>
                <div className="text-2xl font-bold">{activeCount}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                <div className="text-xs text-gray-400 uppercase">Pending Missions</div>
                <div className="text-2xl font-bold">{missions.length}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                <div className="text-xs text-gray-400 uppercase">Estimated Payout</div>
                <div className="text-2xl font-bold">{formatCurrency(payoutTotal)}</div>
              </div>
            </div>
          ) : null}

          {activeTab === "missions" ? (
            <div className="space-y-4">
              <h3 className="text-lg font-bold">Missions</h3>
              {missions.map((m) => (
                <div key={m.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                  <div className="font-bold">{m.pickup} -&gt; {m.dropoff}</div>
                  <div className="text-sm text-myamber font-bold">{formatCurrency(m.payout)}</div>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === "map" ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase mb-3">
                <MapPin className="w-4 h-4" /> Live Map (placeholder)
              </div>
              <div className="h-64 bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center text-gray-500 text-sm">
                Map view coming online.
              </div>
            </div>
          ) : null}

          {activeTab === "messages" ? (
            <div className="max-w-lg">
              <h3 className="text-lg font-bold mb-3">Messages</h3>
              {messages.length === 0 ? (
                <div className="text-sm text-gray-500">No messages yet.</div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="chat-bubble chat-ai">
                    {m.text}
                  </div>
                ))
              )}
            </div>
          ) : null}

          {activeTab === "settings" ? (
            <div className="max-w-xl space-y-4">
              <h3 className="text-lg font-bold">Settings</h3>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <AlertTriangle className="w-3 h-3 text-red-400" /> Safety protocols active
                </div>
                <button
                  onClick={importLegacyRiderData}
                  className="mt-3 text-xs font-bold bg-gray-100 text-gray-700 px-3 py-2 rounded"
                >
                  Import Legacy Local Data
                </button>
              </div>
            </div>
          ) : null}

          {activeTab === "dashboard" ? (
            <div className="mt-6 space-y-4">
              <h3 className="text-lg font-bold">Live Trips</h3>
              {trips.map((t) => (
                <div key={t.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                  <div className="font-bold">{t.route}</div>
                  <div className="text-xs text-gray-400">ETA {t.eta}</div>
                  <div className="mt-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                        t.status === "Delivered"
                          ? "bg-emerald-500/15 text-emerald-600"
                          : t.status === "In-Transit"
                            ? "bg-blue-500/15 text-blue-600"
                            : "bg-amber-500/15 text-amber-600"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
