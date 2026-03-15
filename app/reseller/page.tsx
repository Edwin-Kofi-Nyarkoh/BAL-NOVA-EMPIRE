// app/reseller/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ShoppingBag,
  Package,
  Wallet,
  Users,
  Settings,
  Menu,
  Sun,
  Moon,
  WandSparkles,
  Plus
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { getJSON, postJSON, requestJSON } from "@/lib/sync"
import { LogoutButton } from "@/components/logout-button"
import { useDialog } from "@/components/ui/dialog-service"

type ShopItem = {
  id: string
  name: string
  price: number
  myProfit?: number
  sellingPrice?: number
  myCategory?: string
}

type Listing = {
  id: string
  name: string
  price: number
  cost?: number | null
  status?: string
  inventoryItemId?: string | null
}

type Order = {
  id: string
  item: string
  price: number
  status: string
  createdAt: string
}

type Brand = {
  name: string
  tagline: string
  customDomain?: string | null
}

type TabKey = "dashboard" | "marketplace" | "shop" | "active_orders" | "orders" | "wallet" | "team" | "settings"

export default function ResellerPage() {
  const dialog = useDialog()
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [shop, setShop] = useState<Listing[]>([])
  const [marketplace, setMarketplace] = useState<ShopItem[]>([])
  const [team, setTeam] = useState<{ id?: string; name: string; role: string }[]>([])
  const [brand, setBrand] = useState<Brand>({ name: "", tagline: "Powered by Bal Nova", customDomain: "" })
  const [tier, setTier] = useState(1)
  const [apiKey, setApiKey] = useState("")
  const [aiAdvice, setAiAdvice] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [showCaptionModal, setShowCaptionModal] = useState(false)
  const [captionPrompt, setCaptionPrompt] = useState("")
  const [captionResult, setCaptionResult] = useState("")
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [orderItem, setOrderItem] = useState("")
  const [orderPrice, setOrderPrice] = useState("")
  const [orderCustomer, setOrderCustomer] = useState("")

  useEffect(() => {
    void syncSettings()
    const dark = localStorage.getItem("reseller_theme") === "dark"
    setIsDark(dark)
    document.documentElement.classList.toggle("dark", dark)

    void syncOrders()
    void syncInventory()
    void syncListings()
    void syncBrand()
    void syncTeam()
  }, [])


  async function syncOrders() {
    const data = await getJSON<{ orders: Order[] }>("/api/orders", { orders: [] })
    setOrders(Array.isArray(data.orders) ? data.orders : [])
  }

  async function syncInventory() {
    const data = await getJSON<{ items: ShopItem[] }>("/api/inventory", { items: [] })
    setMarketplace((Array.isArray(data.items) ? data.items : []).map((p: any) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      sellingPrice: p.price
    })))
  }

  async function syncListings() {
    const data = await getJSON<{ listings?: Listing[] }>("/api/reseller/listings", {})
    setShop(Array.isArray(data.listings) ? data.listings : [])
  }

  async function syncBrand() {
    const data = await getJSON<{ user?: { name?: string | null; email?: string | null } }>("/api/me", {})
    const name = data.user?.name || data.user?.email || "Nova Reseller"
    setBrand({ name, tagline: "Powered by Bal Nova" })
    const existing = await getJSON<{ brand?: { name: string; tagline: string; tier: number } | null }>(
      "/api/reseller/brand",
      {}
    )
    if (existing.brand) {
      setBrand({ name: existing.brand.name, tagline: existing.brand.tagline, customDomain: (existing.brand as any).customDomain || "" })
      setTier(existing.brand.tier)
    } else {
      void requestJSON("/api/reseller/brand", { name, tagline: "Powered by Bal Nova", tier }, "PUT", {})
    }
  }

  async function syncTeam() {
    const data = await getJSON<{ team?: { id: string; name: string; role: string }[] }>("/api/reseller/team", {})
    setTeam(Array.isArray(data.team) ? data.team : [])
  }

  async function syncSettings() {
    const data = await getJSON<{ settings?: { apiKey?: string; theme?: string } }>("/api/settings", {})
    if (data.settings?.apiKey) setApiKey(data.settings.apiKey)
    if (data.settings?.theme) {
      const dark = data.settings.theme === "dark"
      setIsDark(dark)
      document.documentElement.classList.toggle("dark", dark)
    }
  }

  const revenue = useMemo(() => orders.reduce((sum, o) => sum + o.price, 0), [orders])
  const credits = useMemo(() => Math.round(revenue / 10), [revenue])

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("reseller_theme", next ? "dark" : "light")
    void requestJSON("/api/settings", { theme: next ? "dark" : "light" }, "PUT", {})
  }

  async function addShopItem() {
    const name = await dialog.prompt("Item name", { placeholder: "Item name" })
    if (!name) return
    const priceRaw = await dialog.prompt("Selling price (GHS)", { placeholder: "0" })
    const price = parseFloat(priceRaw || "0")
    const newItem = await requestJSON<{ listing?: Listing }>(
      "/api/reseller/listings",
      { name, price, status: "active" },
      "POST",
      {}
    )
    const listing = newItem?.listing
    if (listing) {
      setShop((prev) => [listing, ...prev])
    }
  }

  async function addTeam() {
    const name = await dialog.prompt("Team member name", { placeholder: "Team member name" })
    if (!name) return
    const role = (await dialog.prompt("Role", { placeholder: "Associate", defaultValue: "Associate" })) || "Associate"
    void postJSON("/api/reseller/team", { name, role }, {}).then(() => syncTeam())
  }

  async function generateAdvice() {
    if (!apiKey) return
    setAiLoading(true)
    try {
      const prompt = `Give 3 short tips for a reseller. Inventory size: ${shop.length}.`
      const text = await callGemini(apiKey, prompt)
      setAiAdvice(text)
    } finally {
      setAiLoading(false)
    }
  }

  async function addFromMarketplace(item: ShopItem) {
    const priceRaw = await dialog.prompt("Set selling price (GHS)", { defaultValue: String(item.price) })
    if (!priceRaw) return
    const price = parseFloat(priceRaw || "0")
    const res = await requestJSON<{ listing?: Listing }>(
      "/api/reseller/listings",
      { inventoryItemId: item.id, name: item.name, price, cost: item.price, status: "active" },
      "POST",
      {}
    )
    const listing = res?.listing
    if (listing) {
      setShop((prev) => [listing, ...prev])
    }
  }

  async function generateCaption() {
    if (!apiKey || !captionPrompt.trim()) return
    setAiLoading(true)
    try {
      const text = await callGemini(apiKey, captionPrompt.trim())
      setCaptionResult(text)
    } finally {
      setAiLoading(false)
    }
  }

  async function placeCustomerOrder() {
    const item = orderItem.trim()
    const price = parseFloat(orderPrice || "0")
    if (!item || !Number.isFinite(price) || price <= 0) return
    await requestJSON(
      "/api/orders",
      { order: { item, price, status: "Pending", origin: orderCustomer ? `Reseller Order - ${orderCustomer}` : "Reseller Order" } },
      "POST",
      {}
    )
    setOrderItem("")
    setOrderPrice("")
    setOrderCustomer("")
    setShowOrderModal(false)
    void syncOrders()
  }

  async function importLegacyResellerData() {
    const legacyBrand = safeParse<Brand>("balnova_reseller_brand", { name: "", tagline: "" })
    const legacyTeam = safeParse<{ name: string; role: string }[]>("balnova_reseller_team", [])
    const legacyTier = parseInt(localStorage.getItem("balnova_reseller_tier") || "1", 10)
    const legacyApiKey = localStorage.getItem("gemini_api_key") || ""
    const legacyTheme = localStorage.getItem("reseller_theme") || ""

    if (legacyBrand.name) {
      await requestJSON("/api/reseller/brand", { name: legacyBrand.name, tagline: legacyBrand.tagline || "", tier: legacyTier }, "PUT", {})
    }

    await requestJSON("/api/settings", { apiKey: legacyApiKey || "", theme: legacyTheme || "" }, "PUT", {})

    for (const t of legacyTeam) {
      if (t?.name) {
        await postJSON("/api/reseller/team", { name: t.name, role: t.role || "Associate" }, {})
      }
    }

    await syncBrand()
    await syncTeam()
    await syncSettings()
  }

  const navItems: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: "Dashboard", icon: <ShoppingBag className="w-4 h-4" /> },
    { key: "marketplace", label: "Marketplace", icon: <Package className="w-4 h-4" /> },
    { key: "shop", label: "My Shop", icon: <Package className="w-4 h-4" /> },
    { key: "active_orders", label: "Active Orders", icon: <Wallet className="w-4 h-4" /> },
    { key: "orders", label: "Orders", icon: <Wallet className="w-4 h-4" /> },
    { key: "wallet", label: "Credits", icon: <Wallet className="w-4 h-4" /> },
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
        <div className="p-6 border-b border-white/10">
          <h1 className="font-bold text-xl tracking-wide">{brand.name}</h1>
          <p className="text-xs text-myamber/80">{brand.tagline}</p>
          <div className="text-xs text-gray-300 mt-2">Tier {tier}</div>
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
              {navItems.find((n) => n.key === activeTab)?.label || "Reseller"}
            </h2>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors text-myblue dark:text-myamber"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <LogoutButton className="inline-flex text-xs font-bold px-3 py-2 rounded-full border border-myamber/30 text-myamber hover:bg-myamber/10 transition-colors" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          {activeTab === "dashboard" ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                  <div className="text-xs text-gray-400 uppercase">Credits</div>
                  <div className="text-2xl font-bold">{credits}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                  <div className="text-xs text-gray-400 uppercase">Orders</div>
                  <div className="text-2xl font-bold">{orders.length}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                  <div className="text-xs text-gray-400 uppercase">Revenue</div>
                  <div className="text-2xl font-bold">{formatCurrency(revenue)}</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-myblue to-blue-900 rounded-xl p-6 text-white shadow-lg">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-myamber flex items-center gap-2">
                      <WandSparkles className="w-4 h-4" /> Reseller Advisor AI
                    </h3>
                    <p className="text-blue-200 text-sm">Inventory and sales tips.</p>
                  </div>
                  <button
                onClick={generateAdvice}
                className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-bold border border-white/20 transition-colors"
              >
                {aiLoading ? "Generating..." : "Generate"}
              </button>
                </div>
                <div className="bg-black/20 p-4 rounded-lg text-sm leading-relaxed min-h-[60px]">
                  {aiAdvice || "Click Generate to analyze your reseller performance."}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setShowCaptionModal(true)}
                  className="text-xs font-bold bg-myamber text-myblue px-3 py-2 rounded"
                >
                  Viral Caption Writer
                </button>
                <button
                  onClick={() => setShowOrderModal(true)}
                  className="text-xs font-bold bg-myblue text-white px-3 py-2 rounded"
                >
                  Place Customer Order
                </button>
              </div>
            </div>
          ) : null}

          {activeTab === "marketplace" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Marketplace</h3>
                <button
                  onClick={() => setShowCaptionModal(true)}
                  className="text-xs font-bold bg-myamber text-myblue px-3 py-2 rounded"
                >
                  Viral Caption Writer
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {marketplace.map((s) => (
                  <div key={s.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <div className="font-bold">{s.name}</div>
                    <div className="text-sm text-myamber font-bold">{formatCurrency(s.price)}</div>
                    <button
                      onClick={() => addFromMarketplace(s)}
                      className="mt-3 text-xs font-bold bg-mynavy text-white px-3 py-2 rounded"
                    >
                      Add to My Shop
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === "shop" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">My Shop</h3>
                <button onClick={addShopItem} className="text-xs font-bold bg-myamber text-myblue px-3 py-2 rounded">
                  <Plus className="w-3 h-3 inline-block mr-1" /> Add Item
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {shop.map((s) => (
                  <div key={s.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <div className="font-bold">{s.name}</div>
                    <div className="text-sm text-myamber font-bold">{formatCurrency(s.price)}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={async () => {
                          const priceRaw = await dialog.prompt("Update price", { defaultValue: String(s.price) })
                          if (!priceRaw) return
                          const price = parseFloat(priceRaw || "0")
                          await requestJSON(`/api/reseller/listings/${s.id}`, { price }, "PATCH", {})
                          void syncListings()
                        }}
                        className="text-xs text-myamber"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => requestJSON(`/api/reseller/listings/${s.id}`, {}, "DELETE", {}).then(() => syncListings())}
                        className="text-xs text-red-400"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === "active_orders" ? (
            <div className="space-y-4">
              <h3 className="text-lg font-bold">Active Orders</h3>
              {orders.filter((o) => o.status !== "Delivered" && o.status !== "Completed").length === 0 ? (
                <div className="text-sm text-gray-500">No active orders.</div>
              ) : (
                orders
                  .filter((o) => o.status !== "Delivered" && o.status !== "Completed")
                  .map((o) => (
                    <div key={o.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                      <div className="font-bold">{o.item}</div>
                      <div className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleString()}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm text-myamber font-bold">{formatCurrency(o.price)}</span>
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-500/15 text-amber-600">
                          {o.status}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          ) : null}

          {activeTab === "orders" ? (
            <div className="space-y-4">
              <h3 className="text-lg font-bold">Orders</h3>
              {orders.length === 0 ? (
                <div className="text-sm text-gray-500">No orders yet.</div>
              ) : (
                orders.map((o) => (
                  <div key={o.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <div className="font-bold">{o.item}</div>
                    <div className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleString()}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-myamber font-bold">{formatCurrency(o.price)}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                          o.status === "Paid" || o.status === "Delivered"
                            ? "bg-emerald-500/15 text-emerald-600"
                            : "bg-amber-500/15 text-amber-600"
                        }`}
                      >
                        {o.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {activeTab === "wallet" ? (
            <div className="space-y-4">
              <h3 className="text-lg font-bold">Credits</h3>
              <div className="text-2xl font-bold">{credits}</div>
            </div>
          ) : null}

          {activeTab === "team" ? (
            <div className="space-y-3">
              <h3 className="text-lg font-bold">Team</h3>
              <button onClick={addTeam} className="text-xs font-bold bg-myamber text-myblue px-3 py-2 rounded">
                <Plus className="w-3 h-3 inline-block mr-1" /> Add Member
              </button>
              {team.length === 0 ? (
                <div className="text-sm text-gray-500">No team yet.</div>
              ) : (
                team.map((t: any) => (
                  <div key={t.id || t.name} className="text-sm flex items-center justify-between">
                    <span>{t.name} - {t.role}</span>
                    {t.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            const name = await dialog.prompt("Update name", { defaultValue: t.name })
                            if (!name) return
                            const role = await dialog.prompt("Update role", { defaultValue: t.role })
                            if (!role) return
                            void requestJSON(`/api/reseller/team/${t.id}`, { name, role }, "PATCH", {}).then(() => syncTeam())
                          }}
                          className="text-xs text-myamber"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => requestJSON(`/api/reseller/team/${t.id}`, {}, "DELETE", {}).then(() => syncTeam())}
                          className="text-xs text-red-400"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          ) : null}

          {activeTab === "settings" ? (
            <div className="space-y-4 max-w-xl">
              <h3 className="text-lg font-bold">Settings</h3>
              <label className="text-xs font-bold text-gray-500">Brand Name</label>
              <input
                value={brand.name}
                onChange={(e) => setBrand((b) => ({ ...b, name: e.target.value }))}
                className="w-full p-2 rounded border dark:bg-gray-900 dark:border-gray-700"
              />
              <label className="text-xs font-bold text-gray-500">Tagline</label>
              <input
                value={brand.tagline}
                onChange={(e) => setBrand((b) => ({ ...b, tagline: e.target.value }))}
                className="w-full p-2 rounded border dark:bg-gray-900 dark:border-gray-700"
              />
              <label className="text-xs font-bold text-gray-500">Custom Domain</label>
              <input
                value={brand.customDomain || ""}
                onChange={(e) => setBrand((b) => ({ ...b, customDomain: e.target.value }))}
                className="w-full p-2 rounded border dark:bg-gray-900 dark:border-gray-700"
                placeholder="shop.yourbrand.com"
              />
              <button
                onClick={() => requestJSON("/api/reseller/brand", { name: brand.name, tagline: brand.tagline, customDomain: brand.customDomain, tier }, "PUT", {})}
                className="text-xs font-bold bg-myamber text-myblue px-3 py-2 rounded"
              >
                Save Brand
              </button>
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
                onClick={importLegacyResellerData}
                className="text-xs font-bold bg-gray-100 text-gray-700 px-3 py-2 rounded"
              >
                Import Legacy Local Data
              </button>
              <label className="text-xs font-bold text-gray-500">Tier</label>
              <div className="flex gap-2">
                {[1, 2, 3].map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTier(t)
                      void requestJSON("/api/reseller/brand", { name: brand.name, tagline: brand.tagline, tier: t }, "PUT", {})
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

      {showCaptionModal ? (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg dark:text-white">Viral Caption Writer</h3>
              <button onClick={() => setShowCaptionModal(false)} className="text-gray-400 text-xl">x</button>
            </div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Product / Prompt</label>
            <textarea
              value={captionPrompt}
              onChange={(e) => setCaptionPrompt(e.target.value)}
              rows={3}
              className="w-full p-3 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              placeholder="Describe the product and target audience"
            />
            <button
              onClick={generateCaption}
              className="w-full mt-3 bg-mynavy text-white py-2 rounded-lg text-xs font-bold"
            >
              {aiLoading ? "Generating..." : "Generate Caption"}
            </button>
            {captionResult ? (
              <div className="mt-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {captionResult}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showOrderModal ? (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg dark:text-white">Place Customer Order</h3>
              <button onClick={() => setShowOrderModal(false)} className="text-gray-400 text-xl">x</button>
            </div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Item</label>
            <input
              value={orderItem}
              onChange={(e) => setOrderItem(e.target.value)}
              className="w-full p-3 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1 mt-3">Price (GHS)</label>
            <input
              value={orderPrice}
              onChange={(e) => setOrderPrice(e.target.value)}
              className="w-full p-3 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1 mt-3">Customer Name</label>
            <input
              value={orderCustomer}
              onChange={(e) => setOrderCustomer(e.target.value)}
              className="w-full p-3 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
            <button
              onClick={placeCustomerOrder}
              className="w-full mt-4 bg-myamber text-myblue py-3 rounded-xl font-bold"
            >
              Create Order
            </button>
          </div>
        </div>
      ) : null}
    </div>
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

function safeParse<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}


