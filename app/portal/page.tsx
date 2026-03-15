// app/portal/page.tsx
"use client"

import { useMemo, useState, useEffect } from "react"
import {
  LayoutDashboard,
  Boxes,
  Truck,
  Wallet,
  ShieldCheck,
  Settings,
  Menu,
  Plus,
  Bike,
  Sun,
  Moon,
  Users,
  Building2,
  WandSparkles
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { getJSON, postJSON, requestJSON } from "@/lib/sync"
import { LogoutButton } from "@/components/logout-button"
import { useDialog } from "@/components/ui/dialog-service"

type Product = {
  id: string
  name: string
  price: number
  baseStock?: number
}

type Order = {
  id: string
  item: string
  status: string
  price: number
  createdAt: string
  origin?: string | null
}

type WalletTx = {
  id: string
  desc: string
  amount: number
  ts: number
}

type VendorProfile = {
  name: string
  initials: string
  tier: number
}

type TabKey = "dashboard" | "inventory" | "orders" | "wallet" | "qc" | "team" | "settings"

export default function VendorPortalPage() {
  const dialog = useDialog()
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [qcLogs, setQcLogs] = useState<string[]>([])
  const [tier, setTier] = useState<number>(1)
  const [profile, setProfile] = useState<VendorProfile>({ name: "", initials: "", tier: 1 })
  const [isDark, setIsDark] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPickupModal, setShowPickupModal] = useState(false)
  const [showCharterModal, setShowCharterModal] = useState(false)
  const [showQcModal, setShowQcModal] = useState(false)
  const [showPosModal, setShowPosModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showAiModal, setShowAiModal] = useState(false)
  const [newProductName, setNewProductName] = useState("")
  const [newProductPrice, setNewProductPrice] = useState("")
  const [newProductStock, setNewProductStock] = useState("")
  const [posItem, setPosItem] = useState("")
  const [posPrice, setPosPrice] = useState("")
  const [posHub, setPosHub] = useState("")
  const [posCustomer, setPosCustomer] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiResponse, setAiResponse] = useState("")
  const [aiAssistantLoading, setAiAssistantLoading] = useState(false)
  const [aiReport, setAiReport] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [staff, setStaff] = useState<{ id: string; name: string; role: string }[]>([])
  const [hubs, setHubs] = useState<{ id: string; name: string }[]>([])
  const [activeRegion, setActiveRegion] = useState("GH")

  useEffect(() => {
    const storedTheme = localStorage.getItem("vendor_theme")
    const dark = storedTheme === "dark"
    setIsDark(dark)
    document.documentElement.classList.toggle("dark", dark)

    void syncInventory()
    void syncOrders()
    void syncProfile()
    void syncSettings()
    void syncStaff()
    void syncHubs()
    void syncQc()
  }, [])

  async function syncInventory() {
    const data = await getJSON<{ items: Product[] }>("/api/inventory", { items: [] })
    setProducts(Array.isArray(data.items) ? data.items : [])
  }

  async function syncOrders() {
    const data = await getJSON<{ orders: Order[] }>("/api/orders", { orders: [] })
    setOrders(Array.isArray(data.orders) ? data.orders : [])
  }

  async function syncProfile() {
    const data = await getJSON<{ profile?: VendorProfile | null }>("/api/vendor/profile", {})
    if (data.profile) {
      setProfile({ name: data.profile.name, initials: data.profile.initials, tier: data.profile.tier ?? 1 })
      setTier(data.profile.tier ?? 1)
      return
    }
    const me = await getJSON<{ user?: { name?: string | null; email?: string | null } }>("/api/me", {})
    const name = me.user?.name || me.user?.email || "Vendor"
    const initials = name
      .split(" ")
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
    setProfile({ name, initials, tier: 1 })
    await requestJSON("/api/vendor/profile", { name, initials, tier: 1 }, "PUT", {})
  }

  async function syncSettings() {
    const data = await getJSON<{ settings?: { region?: string; apiKey?: string; theme?: string } }>("/api/settings", {})
    if (data.settings?.region) setActiveRegion(data.settings.region)
    if (data.settings?.apiKey) setApiKey(data.settings.apiKey)
    if (data.settings?.theme) {
      const dark = data.settings.theme === "dark"
      setIsDark(dark)
      document.documentElement.classList.toggle("dark", dark)
    }
  }

  async function syncStaff() {
    const data = await getJSON<{ staff?: { id: string; name: string; role: string }[] }>("/api/vendor/staff", {})
    setStaff(Array.isArray(data.staff) ? data.staff : [])
  }

  async function syncHubs() {
    const data = await getJSON<{ hubs?: { id: string; name: string }[] }>("/api/vendor/hubs", {})
    setHubs(Array.isArray(data.hubs) ? data.hubs : [])
  }

  async function syncQc() {
    const data = await getJSON<{ logs?: { id: string; status: string; message: string }[] }>("/api/qc", {})
    const logs = Array.isArray(data.logs) ? data.logs : []
    setQcLogs(logs.map((l) => `${l.status.toUpperCase()}: ${l.message}`))
  }

  const wallet = useMemo<WalletTx[]>(
    () =>
      orders.map((o) => ({
        id: `TX-${o.id}`,
        desc: o.item,
        amount: o.price,
        ts: new Date(o.createdAt).getTime()
      })),
    [orders]
  )
  const escrowBalance = useMemo(() => wallet.reduce((sum, t) => sum + t.amount, 0), [wallet])
  const inventoryValue = useMemo(
    () => products.reduce((sum, p) => sum + p.price * (p.baseStock || 1), 0),
    [products]
  )

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("vendor_theme", next ? "dark" : "light")
    void requestJSON("/api/settings", { theme: next ? "dark" : "light" }, "PUT", {})
  }

  function addProduct() {
    setShowAddModal(true)
  }

  function saveNewProduct() {
    const name = newProductName.trim()
    if (!name) return
    const price = parseFloat(newProductPrice || "0")
    const stock = parseInt(newProductStock || "1", 10)
    const newProduct: Product = {
      id: `P-${Date.now()}`,
      name,
      price: isNaN(price) ? 0 : price,
      baseStock: isNaN(stock) ? 1 : stock
    }
    setProducts((prev) => [newProduct, ...prev])
    void postJSON("/api/inventory", { item: newProduct }, { items: [] })
    setNewProductName("")
    setNewProductPrice("")
    setNewProductStock("")
    setShowAddModal(false)
  }

  function requestPickup() {
    setShowPickupModal(true)
  }

  async function resetVendorSystem() {
    const ok = await dialog.confirm("Wipe ALL Vendor Data?")
    if (!ok) return
    window.location.reload()
  }

  async function importLegacyVendorData() {
    const legacyProfile = safeParse<VendorProfile>("balnova_vendor_profile", { name: "", initials: "", tier: 1 })
    const legacyTier = parseInt(localStorage.getItem("vendor_tier") || "1", 10)
    const legacyApiKey = localStorage.getItem("gemini_api_key") || ""
    const legacyRegion = localStorage.getItem("balnova_active_region") || ""
    const legacyTheme = localStorage.getItem("vendor_theme") || ""
    const legacyStaff = safeParse<{ name: string; role: string }[]>("balnova_vendor_staff", [])
    const legacyHubs = safeParse<string[]>("balnova_vendor_hubs", [])

    if (legacyProfile.name) {
      await requestJSON(
        "/api/vendor/profile",
        { name: legacyProfile.name, initials: legacyProfile.initials || "", tier: legacyTier || 1 },
        "PUT",
        {}
      )
    }

    await requestJSON(
      "/api/settings",
      {
        apiKey: legacyApiKey || "",
        region: legacyRegion || "",
        theme: legacyTheme || ""
      },
      "PUT",
      {}
    )

    for (const s of legacyStaff) {
      if (s?.name) {
        await postJSON("/api/vendor/staff", { name: s.name, role: s.role || "Clerk" }, {})
      }
    }

    for (const h of legacyHubs) {
      if (h) {
        await postJSON("/api/vendor/hubs", { name: h }, {})
      }
    }

    await syncProfile()
    await syncSettings()
    await syncStaff()
    await syncHubs()
  }

  async function generateShopReport() {
    if (!apiKey) return
    setAiLoading(true)
    try {
      const sales = wallet.filter((t) => t.amount > 0).map((t) => t.desc).join(", ")
      const prompt = `Analyze vendor sales: ${sales || "No sales yet"}. Inventory size: ${products.length}. Give 3 strategic tips.`
      const text = await callGemini(apiKey, prompt)
      setAiReport(text)
    } finally {
      setAiLoading(false)
    }
  }

  async function addStaff() {
    const name = await dialog.prompt("Staff Name", { placeholder: "Staff Name" })
    if (!name) return
    void postJSON("/api/vendor/staff", { name, role: "Clerk" }, {}).then(() => syncStaff())
  }

  function removeStaff(id: string) {
    void requestJSON(`/api/vendor/staff/${id}`, {}, "DELETE", {}).then(() => syncStaff())
  }

  async function addHub() {
    const name = await dialog.prompt("Hub Name", { placeholder: "Hub Name" })
    if (!name) return
    void postJSON("/api/vendor/hubs", { name }, {}).then(() => syncHubs())
  }

  async function openProductDetails(p: Product) {
    setSelectedProduct(p)
    setShowDetailModal(true)
  }

  async function submitPosOrder() {
    const item = posItem.trim()
    const price = parseFloat(posPrice || "0")
    if (!item || !Number.isFinite(price) || price <= 0) return
    const origin = posHub || "Vendor POS"
    await requestJSON(
      "/api/orders",
      { order: { item, price, status: "Completed", origin: posCustomer ? `${origin} - ${posCustomer}` : origin } },
      "POST",
      {}
    )
    setPosItem("")
    setPosPrice("")
    setPosHub("")
    setPosCustomer("")
    setShowPosModal(false)
    void syncOrders()
  }

  async function generateAiAssistant() {
    if (!apiKey || !aiPrompt.trim()) return
    setAiAssistantLoading(true)
    try {
      const text = await callGemini(apiKey, aiPrompt.trim())
      setAiResponse(text)
    } finally {
      setAiAssistantLoading(false)
    }
  }

  const navItems: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { key: "inventory", label: "Inventory", icon: <Boxes className="w-4 h-4" /> },
    { key: "orders", label: "Active Orders", icon: <Truck className="w-4 h-4" /> },
    { key: "wallet", label: "Wallet & Escrow", icon: <Wallet className="w-4 h-4" /> },
    { key: "qc", label: "QC & Firewall", icon: <ShieldCheck className="w-4 h-4" /> },
    { key: "team", label: "Team Management", icon: <Users className="w-4 h-4" /> },
    { key: "settings", label: "Settings & Tiers", icon: <Settings className="w-4 h-4" /> }
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
            <ShieldCheck className="text-myamber w-8 h-8" />
          </div>
          <h1 className="font-bold text-xl tracking-wide">BAL NOVA</h1>
          <p className="text-xs text-myamber/80 mb-3">
            Vendor Portal <span className="bg-white/20 px-1 rounded text-[10px] ml-1">TIER {tier}</span>
          </p>
          <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden mb-1">
            <div className="bg-green-500 h-full" style={{ width: "100%" }} />
          </div>
          <div className="w-full flex justify-between text-[9px] text-gray-300 font-mono mb-2">
            <span>Trust Score</span>
            <span className="font-bold text-green-400">100%</span>
          </div>
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

        <div className="p-4 border-t border-white/10">
          <button
            onClick={resetVendorSystem}
            className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            Reset System
          </button>
        </div>
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
              {navItems.find((n) => n.key === activeTab)?.label || "Command Center"}
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
            <div className="flex items-center gap-3 border-l pl-4 border-gray-300 dark:border-gray-600">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-gray-900 dark:text-white">{profile.name}</div>
                <div className="text-xs text-green-500 font-medium flex items-center justify-end gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live Sync
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-myamber text-myblue font-bold flex items-center justify-center border-2 border-white dark:border-gray-700 shadow-sm">
                {profile.initials}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          {activeTab === "dashboard" ? (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gradient-to-r from-myblue to-myamber rounded-xl p-5 shadow-lg text-white">
                  <div className="text-xs font-bold opacity-80 uppercase tracking-wider mb-1">Escrow Balance</div>
                  <div className="text-2xl font-black">{formatCurrency(escrowBalance)}</div>
                  <div className="text-[10px] mt-1 opacity-70">Releases 5 days after delivery</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border-l-4 border-myblue">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Inventory Value</div>
                  <div className="text-2xl font-bold text-gray-800 dark:text-white">{formatCurrency(inventoryValue)}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border-l-4 border-purple-500">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Active Listings</div>
                  <div className="text-2xl font-bold text-gray-800 dark:text-white">{products.length}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border-l-4 border-green-500">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Pending Actions</div>
                  <div className="text-2xl font-bold text-gray-800 dark:text-white">
                    {orders.filter((o) => o.status === "Pending").length}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mb-6">
                <button
                  onClick={addProduct}
                  className="bg-myamber hover:bg-amber-500 text-myblue font-bold py-2.5 px-5 rounded-lg shadow-sm transition-transform active:scale-95 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Product
                </button>
                <button
                  onClick={() => setShowPosModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-5 rounded-lg shadow-sm transition-transform active:scale-95 flex items-center gap-2"
                >
                  Manual Sale (POS)
                </button>
                <button
                  onClick={requestPickup}
                  className="bg-myblue hover:bg-blue-900 text-white font-semibold py-2.5 px-5 rounded-lg shadow-sm transition-transform active:scale-95 flex items-center gap-2"
                >
                  <Bike className="w-4 h-4" /> Request Pickup
                </button>
                <button
                  onClick={() => setShowCharterModal(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 px-5 rounded-lg shadow-sm transition-transform active:scale-95 flex items-center gap-2"
                >
                  Book Van
                </button>
                <button
                  onClick={() => setShowAiModal(true)}
                  className="bg-black/80 hover:bg-black text-white font-semibold py-2.5 px-5 rounded-lg shadow-sm transition-transform active:scale-95 flex items-center gap-2"
                >
                  AI Assistant
                </button>
              </div>

              <div className="bg-gradient-to-r from-myblue to-blue-900 rounded-xl p-6 text-white shadow-lg mb-8 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-myamber flex items-center gap-2">
                        <WandSparkles className="w-4 h-4" /> Shop Analyst AI
                      </h3>
                      <p className="text-blue-200 text-sm">Real-time performance insights & predictions.</p>
                    </div>
                    <button
                      onClick={generateShopReport}
                      className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-bold border border-white/20 transition-colors"
                    >
                      {aiLoading ? "Generating..." : "Generate Report"}
                    </button>
                  </div>
                  <div className="bg-black/20 p-4 rounded-lg text-sm leading-relaxed min-h-[60px]">
                    {aiReport ? aiReport : "Click Generate Report to scan your inventory performance."}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "inventory" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Inventory</h3>
                <button onClick={addProduct} className="text-xs font-bold bg-myamber text-myblue px-3 py-2 rounded">
                  Add Product
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => openProductDetails(p)}
                    className="text-left bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:border-myamber transition"
                  >
                    <div className="font-bold">{p.name}</div>
                    <div className="text-xs text-gray-400">Stock: {p.baseStock || 0}</div>
                    <div className="text-sm text-myamber font-bold">{formatCurrency(p.price)}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === "orders" ? (
            <div className="space-y-4">
              <h3 className="text-lg font-bold">Active Orders</h3>
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
              <h3 className="text-lg font-bold">Wallet & Escrow</h3>
              {wallet.length === 0 ? (
                <div className="text-sm text-gray-500">No transactions yet.</div>
              ) : (
                wallet.map((t) => (
                  <div key={t.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <div className="font-bold">{t.desc}</div>
                    <div className="text-xs text-gray-400">{new Date(t.ts).toLocaleString()}</div>
                    <div className="text-sm text-myamber font-bold">{formatCurrency(t.amount)}</div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {activeTab === "qc" ? (
            <div className="space-y-4">
              <h3 className="text-lg font-bold">QC & Firewall</h3>
              {qcLogs.length === 0 ? (
                <div className="text-sm text-gray-500">No QC events yet.</div>
              ) : (
                qcLogs.map((l, idx) => (
                  <div key={idx} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 text-sm">
                    {l}
                  </div>
                ))
              )}
              <button
                onClick={async () => {
                  const status = await dialog.prompt("QC Status", { placeholder: "passed / failed", defaultValue: "passed" })
                  if (!status) return
                  const message = await dialog.prompt("QC Message", { placeholder: "Describe the QC check" })
                  if (!message) return
                  await requestJSON("/api/qc", { status, message }, "POST", {})
                  void syncQc()
                }}
                className="text-xs font-bold bg-myamber text-myblue px-3 py-2 rounded"
              >
                Log QC Event
              </button>
            </div>
          ) : null}

          {activeTab === "team" ? (
            <div className="space-y-6 max-w-2xl">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Team Management</h3>
                  <button onClick={addStaff} className="text-xs font-bold text-myamber">Add Staff</button>
                </div>
                {staff.length === 0 ? (
                  <div className="text-sm text-gray-500">No staff yet.</div>
                ) : (
                  staff.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                      <div>
                        <div className="font-bold">{s.name}</div>
                        <div className="text-xs text-gray-400">{s.role}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            const name = await dialog.prompt("Update name", { defaultValue: s.name })
                            if (!name) return
                            const role = await dialog.prompt("Update role", { defaultValue: s.role })
                            if (!role) return
                            void requestJSON(`/api/vendor/staff/${s.id}`, { name, role }, "PATCH", {}).then(() => syncStaff())
                          }}
                          className="text-myamber text-xs"
                        >
                          Edit
                        </button>
                        <button onClick={() => removeStaff(s.id)} className="text-red-400 text-xs">Remove</button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Hub Locations</h3>
                  <button onClick={addHub} className="text-xs font-bold text-myamber">Add Hub</button>
                </div>
                {hubs.length === 0 ? (
                  <div className="text-sm text-gray-500">No hubs yet.</div>
                ) : (
                  hubs.map((h) => (
                    <div key={h.id} className="flex items-center justify-between text-sm bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span>{h.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            const name = await dialog.prompt("Update hub name", { defaultValue: h.name })
                            if (!name) return
                            void requestJSON(`/api/vendor/hubs/${h.id}`, { name }, "PATCH", {}).then(() => syncHubs())
                          }}
                          className="text-myamber text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => requestJSON(`/api/vendor/hubs/${h.id}`, {}, "DELETE", {}).then(() => syncHubs())}
                          className="text-red-400 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "settings" ? (
            <div className="space-y-4 max-w-xl">
              <h3 className="text-lg font-bold">Settings & Tiers</h3>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 space-y-3">
                <label className="text-xs font-bold text-gray-500">Vendor Name</label>
                <input
                  value={profile.name}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  className="w-full p-2 rounded border dark:bg-gray-900 dark:border-gray-700"
                />
                <label className="text-xs font-bold text-gray-500">Gemini API Key</label>
                <input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full p-2 rounded border dark:bg-gray-900 dark:border-gray-700"
                />
                <button
                  onClick={() => requestJSON("/api/settings", { apiKey, region: activeRegion }, "PUT", {})}
                  className="text-xs font-bold bg-myamber text-myblue px-3 py-2 rounded"
                >
                  Save API Key
                </button>
                <button
                  onClick={importLegacyVendorData}
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
                        void requestJSON("/api/vendor/profile", { name: profile.name, initials: profile.initials, tier: t }, "PUT", {})
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
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-gray-500">Team</div>
                    <button onClick={addStaff} className="text-xs font-bold text-myamber">Add Staff</button>
                  </div>
                  <div className="space-y-2 mt-2">
                    {staff.length === 0 ? (
                      <div className="text-xs text-gray-500">No staff yet.</div>
                    ) : (
                      staff.map((s) => (
                        <div key={s.id} className="flex items-center justify-between text-xs">
                          <span>{s.name} - {s.role}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                const name = await dialog.prompt("Update name", { defaultValue: s.name })
                                if (!name) return
                                const role = await dialog.prompt("Update role", { defaultValue: s.role })
                                if (!role) return
                                void requestJSON(`/api/vendor/staff/${s.id}`, { name, role }, "PATCH", {}).then(() => syncStaff())
                              }}
                              className="text-myamber"
                            >
                              Edit
                            </button>
                            <button onClick={() => removeStaff(s.id)} className="text-red-400">Remove</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-gray-500">Hubs</div>
                    <button onClick={addHub} className="text-xs font-bold text-myamber">Add Hub</button>
                  </div>
                  <div className="space-y-1 mt-2 text-xs">
                    {hubs.map((h) => (
                      <div key={h.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3 h-3 text-gray-400" />
                          <span>{h.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              const name = await dialog.prompt("Update hub name", { defaultValue: h.name })
                              if (!name) return
                              void requestJSON(`/api/vendor/hubs/${h.id}`, { name }, "PATCH", {}).then(() => syncHubs())
                            }}
                            className="text-myamber text-[10px]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => requestJSON(`/api/vendor/hubs/${h.id}`, {}, "DELETE", {}).then(() => syncHubs())}
                            className="text-red-400 text-[10px]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-xs font-bold text-gray-500 mb-1">Active Region</div>
                  <select
                    value={activeRegion}
                    onChange={(e) => {
                      const value = e.target.value
                      setActiveRegion(value)
                      void requestJSON("/api/settings", { region: value, apiKey }, "PUT", {})
                    }}
                    className="w-full p-2 rounded border dark:bg-gray-900 dark:border-gray-700 text-xs"
                  >
                    <option value="GH">Ghana</option>
                    <option value="NG">Nigeria</option>
                    <option value="CI">Cote d&apos;Ivoire</option>
                  </select>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      {showAddModal ? (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg dark:text-white">Add Product</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 text-xl">x</button>
            </div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Name</label>
            <input
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              className="w-full p-3 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1 mt-3">Price (GHS)</label>
            <input
              value={newProductPrice}
              onChange={(e) => setNewProductPrice(e.target.value)}
              className="w-full p-3 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1 mt-3">Base Stock</label>
            <input
              value={newProductStock}
              onChange={(e) => setNewProductStock(e.target.value)}
              className="w-full p-3 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
            <button
              onClick={saveNewProduct}
              className="w-full mt-4 bg-myamber text-myblue py-3 rounded-xl font-bold"
            >
              Save Product
            </button>
          </div>
        </div>
      ) : null}

      {showDetailModal && selectedProduct ? (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg dark:text-white">Product Details</h3>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-400 text-xl">x</button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="font-bold text-lg">{selectedProduct.name}</div>
              <div className="text-myamber font-bold">{formatCurrency(selectedProduct.price)}</div>
              <div className="text-xs text-gray-500">Stock: {selectedProduct.baseStock || 0}</div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setShowDetailModal(false)
                  setShowAddModal(false)
                }}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPosModal ? (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg dark:text-white">Manual Sale (POS)</h3>
              <button onClick={() => setShowPosModal(false)} className="text-gray-400 text-xl">x</button>
            </div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Item</label>
            <input
              value={posItem}
              onChange={(e) => setPosItem(e.target.value)}
              className="w-full p-3 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1 mt-3">Price (GHS)</label>
            <input
              value={posPrice}
              onChange={(e) => setPosPrice(e.target.value)}
              className="w-full p-3 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1 mt-3">Pickup Hub</label>
            <input
              value={posHub}
              onChange={(e) => setPosHub(e.target.value)}
              placeholder="e.g. Spintex Hub"
              className="w-full p-3 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1 mt-3">Customer Name</label>
            <input
              value={posCustomer}
              onChange={(e) => setPosCustomer(e.target.value)}
              className="w-full p-3 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
            <button
              onClick={submitPosOrder}
              className="w-full mt-4 bg-emerald-600 text-white py-3 rounded-xl font-bold"
            >
              Create Sale
            </button>
          </div>
        </div>
      ) : null}

      {showAiModal ? (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg dark:text-white">AI Assistant</h3>
              <button onClick={() => setShowAiModal(false)} className="text-gray-400 text-xl">x</button>
            </div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Prompt</label>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={3}
              className="w-full p-3 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              placeholder="Ask about sales strategy, inventory, pricing..."
            />
            <button
              onClick={generateAiAssistant}
              className="w-full mt-3 bg-black text-white py-2 rounded-lg text-xs font-bold"
            >
              {aiAssistantLoading ? "Generating..." : "Generate"}
            </button>
            {aiResponse ? (
              <div className="mt-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {aiResponse}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showPickupModal ? (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg dark:text-white">Request Pickup</h3>
              <button onClick={() => setShowPickupModal(false)} className="text-gray-400 text-xl">x</button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-300">Pickup request submitted. A rider will be assigned.</p>
            <button onClick={() => setShowPickupModal(false)} className="w-full mt-4 bg-myblue text-white py-3 rounded-xl font-bold">
              Close
            </button>
          </div>
        </div>
      ) : null}

      {showCharterModal ? (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg dark:text-white">Book Van</h3>
              <button onClick={() => setShowCharterModal(false)} className="text-gray-400 text-xl">x</button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-300">Charter request received. Ops will contact you.</p>
            <button onClick={() => setShowCharterModal(false)} className="w-full mt-4 bg-purple-600 text-white py-3 rounded-xl font-bold">
              Close
            </button>
          </div>
        </div>
      ) : null}

      {showQcModal ? (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg dark:text-white">QC Event</h3>
              <button onClick={() => setShowQcModal(false)} className="text-gray-400 text-xl">x</button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-300">QC log saved.</p>
            <button onClick={() => setShowQcModal(false)} className="w-full mt-4 bg-myblue text-white py-3 rounded-xl font-bold">
              Close
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


