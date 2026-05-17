// app/portal/page.tsx
"use client"

import { useMemo, useState, useEffect } from "react"
import Link from "next/link"
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
  brand?: string | null
  desc?: string | null
  imageUrl?: string | null
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
  userId?: string
  bio?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  businessAddress?: string | null
}

type TabKey = "dashboard" | "inventory" | "orders" | "wallet" | "qc" | "settings"

export default function VendorPortalPage() {
  const dialog = useDialog()
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [qcLogs, setQcLogs] = useState<string[]>([])
  const [tier, setTier] = useState<number>(1)
  const [profile, setProfile] = useState<VendorProfile>({
    name: "",
    initials: "",
    tier: 1,
    userId: "",
    bio: "",
    contactPhone: "",
    contactEmail: "",
    businessAddress: ""
  })
  const [isDark, setIsDark] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPickupModal, setShowPickupModal] = useState(false)
  const [showCharterModal, setShowCharterModal] = useState(false)
  const [showQcModal, setShowQcModal] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState("")
  const [newProductName, setNewProductName] = useState("")
  const [newProductBrand, setNewProductBrand] = useState("")
  const [newProductPrice, setNewProductPrice] = useState("")
  const [newProductStock, setNewProductStock] = useState("")
  const [newProductDesc, setNewProductDesc] = useState("")
  const [newProductImageFile, setNewProductImageFile] = useState<File | null>(null)
  const [newProductImagePreview, setNewProductImagePreview] = useState<string | null>(null)
  const [editProductImageFile, setEditProductImageFile] = useState<File | null>(null)
  const [editProductImagePreview, setEditProductImagePreview] = useState<string | null>(null)
  const [editProductImageUrl, setEditProductImageUrl] = useState("")
  const [aiReport, setAiReport] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [productSaving, setProductSaving] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [staff, setStaff] = useState<{ id: string; name: string; role: string }[]>([])
  const [hubs, setHubs] = useState<{ id: string; name: string }[]>([])
  const [activeRegion, setActiveRegion] = useState("GH")
  const [pickupMode, setPickupMode] = useState<"self-drop" | "bal-pickup">("self-drop")
  const [withdrawSchedule, setWithdrawSchedule] = useState<"daily" | "weekly" | "monthly">("weekly")
  const [editableProductId, setEditableProductId] = useState<string | null>(null)

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
  }, [])

  useEffect(() => {
    if (!newProductImageFile) {
      setNewProductImagePreview(null)
      return
    }
    const url = URL.createObjectURL(newProductImageFile)
    setNewProductImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [newProductImageFile])

  useEffect(() => {
    if (!editProductImageFile) {
      setEditProductImagePreview(null)
      return
    }
    const url = URL.createObjectURL(editProductImageFile)
    setEditProductImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [editProductImageFile])

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
      const me = await getJSON<{ user?: { id?: string | null } }>("/api/me", {})
      setProfile({
        name: data.profile.name,
        initials: data.profile.initials,
        tier: data.profile.tier ?? 1,
        userId: me.user?.id || "",
        bio: data.profile.bio ?? "",
        contactPhone: data.profile.contactPhone ?? "",
        contactEmail: data.profile.contactEmail ?? "",
        businessAddress: data.profile.businessAddress ?? ""
      })
      setTier(data.profile.tier ?? 1)
      return
    }
    const me = await getJSON<{ user?: { id?: string | null; name?: string | null; email?: string | null } }>("/api/me", {})
    const name = me.user?.name || me.user?.email || "Vendor"
    const initials = name
      .split(" ")
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
    setProfile({
      name,
      initials,
      tier: 1,
      userId: me.user?.id || "",
      bio: "",
      contactPhone: "",
      contactEmail: "",
      businessAddress: ""
    })
    await requestJSON("/api/vendor/profile", { name, initials, tier: 1 }, "PUT", {})
  }

  async function syncSettings() {
    const data = await getJSON<{
      settings?: {
        region?: string
        apiKey?: string
        theme?: string
        vendorPickupMode?: "self-drop" | "bal-pickup"
        vendorWithdrawSchedule?: "daily" | "weekly" | "monthly"
      }
    }>("/api/settings", {})
    if (data.settings?.region) setActiveRegion(data.settings.region)
    if (data.settings?.apiKey) setApiKey(data.settings.apiKey)
    if (data.settings?.vendorPickupMode) setPickupMode(data.settings.vendorPickupMode)
    if (data.settings?.vendorWithdrawSchedule) setWithdrawSchedule(data.settings.vendorWithdrawSchedule)
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
  const weeklySalesBars = useMemo(() => {
    const bars = new Array(7).fill(0)
    for (const tx of wallet) {
      const date = new Date(tx.ts)
      const day = date.getDay()
      bars[day] += tx.amount
    }
    return bars
  }, [wallet])
  const storefrontLink = useMemo(() => {
    return `/vendors/${encodeURIComponent(profile.userId || "")}`
  }, [profile.userId])

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("vendor_theme", next ? "dark" : "light")
    void requestJSON("/api/settings", { theme: next ? "dark" : "light" }, "PUT", {})
  }

  function addProduct() {
    resetProductForm()
    setShowAddModal(true)
  }

  async function saveNewProduct() {
    const name = newProductName.trim()
    if (!name) return
    const price = parseFloat(newProductPrice || "0")
    const stock = parseInt(newProductStock || "1", 10)
    if (newProductImageFile && newProductImageFile.size > 5 * 1024 * 1024) {
      await dialog.alert("Image is too large. Please use a file under 5MB.")
      return
    }

    setProductSaving(true)
    try {
      let imageUrl: string | null = null
      if (newProductImageFile) {
        imageUrl = await uploadImage(newProductImageFile)
      }
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: {
            name,
            brand: newProductBrand.trim() || null,
            price: isNaN(price) ? 0 : price,
            baseStock: isNaN(stock) ? 1 : stock,
            desc: newProductDesc.trim() || null,
            imageUrl
          }
        })
      })
      const data = (await res.json().catch(() => ({}))) as { items?: Product[]; error?: string }
      if (!res.ok) {
        throw new Error(data.error || "Could not save this product yet.")
      }
      if (Array.isArray(data.items)) {
        setProducts(data.items)
      } else {
        await syncInventory()
      }
      resetProductForm()
      setShowAddModal(false)
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : "Could not save this product yet.")
    } finally {
      setProductSaving(false)
    }
  }

  function requestPickup() {
    setShowPickupModal(true)
  }

  function persistPickupMode(next: "self-drop" | "bal-pickup") {
    setPickupMode(next)
    void requestJSON("/api/settings", { vendorPickupMode: next }, "PUT", {})
  }

  function persistWithdrawSchedule(next: "daily" | "weekly" | "monthly") {
    setWithdrawSchedule(next)
    void requestJSON("/api/settings", { vendorWithdrawSchedule: next }, "PUT", {})
  }

  function deriveInitials(name: string) {
    return name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
  }

  async function saveVendorProfile(nextTier = tier) {
    const name = profile.name.trim()
    if (!name) {
      setProfileMessage("Vendor name is required.")
      return
    }

    const initials = deriveInitials(name) || profile.initials || "VN"
    const payload = {
      name,
      initials,
      tier: nextTier,
      bio: profile.bio?.trim() || null,
      contactPhone: profile.contactPhone?.trim() || null,
      contactEmail: profile.contactEmail?.trim() || null,
      businessAddress: profile.businessAddress?.trim() || null
    }

    setProfileSaving(true)
    setProfileMessage("")
    try {
      const res = await fetch("/api/vendor/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Could not save vendor profile.")
      }

      setTier(nextTier)
      setProfile((prev) => ({
        ...prev,
        name,
        initials,
        tier: nextTier,
        bio: data?.profile?.bio ?? payload.bio ?? "",
        contactPhone: data?.profile?.contactPhone ?? payload.contactPhone ?? "",
        contactEmail: data?.profile?.contactEmail ?? payload.contactEmail ?? "",
        businessAddress: data?.profile?.businessAddress ?? payload.businessAddress ?? ""
      }))
      setProfileMessage("Vendor profile saved.")
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Could not save vendor profile.")
    } finally {
      setProfileSaving(false)
    }
  }

  function resetProductForm() {
    setNewProductName("")
    setNewProductBrand("")
    setNewProductPrice("")
    setNewProductStock("")
    setNewProductDesc("")
    setNewProductImageFile(null)
    setNewProductImagePreview(null)
  }

  function resetEditableForm() {
    setEditableProductId(null)
    setNewProductName("")
    setNewProductBrand("")
    setNewProductPrice("")
    setNewProductStock("")
    setNewProductDesc("")
    setEditProductImageFile(null)
    setEditProductImagePreview(null)
    setEditProductImageUrl("")
  }

  async function uploadImage(file: File) {
    const formData = new FormData()
    formData.append("file", file)

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(typeof data?.error === "string" ? data.error : "Upload failed")
    }
    return String(data?.url || "")
  }

  async function resetVendorSystem() {
    const ok = await dialog.confirm("Wipe ALL Vendor Data?")
    if (!ok) return
    window.location.reload()
  }

  async function importLegacyVendorData() {
    const legacyProfile = safeParse<VendorProfile>("balnova_vendor_profile", {
      name: "",
      initials: "",
      tier: 1,
      userId: "",
      bio: "",
      contactPhone: "",
      contactEmail: "",
      businessAddress: ""
    })
    const legacyTier = parseInt(localStorage.getItem("vendor_tier") || "1", 10)
    const legacyApiKey = localStorage.getItem("gemini_api_key") || ""
    const legacyRegion = localStorage.getItem("balnova_active_region") || ""
    const legacyTheme = localStorage.getItem("vendor_theme") || ""
    const legacyStaff = safeParse<{ name: string; role: string }[]>("balnova_vendor_staff", [])
    const legacyHubs = safeParse<string[]>("balnova_vendor_hubs", [])

    if (legacyProfile.name) {
      await requestJSON(
        "/api/vendor/profile",
        {
          name: legacyProfile.name,
          initials: legacyProfile.initials || "",
          tier: legacyTier || 1,
          bio: legacyProfile.bio || "",
          contactPhone: legacyProfile.contactPhone || "",
          contactEmail: legacyProfile.contactEmail || "",
          businessAddress: legacyProfile.businessAddress || ""
        },
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

  const navItems: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { key: "inventory", label: "Inventory", icon: <Boxes className="w-4 h-4" /> },
    { key: "orders", label: "Active Orders", icon: <Truck className="w-4 h-4" /> },
    { key: "wallet", label: "Wallet & Escrow", icon: <Wallet className="w-4 h-4" /> },
    { key: "qc", label: "QC & Firewall", icon: <ShieldCheck className="w-4 h-4" /> },
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
          <Link href="/" className="flex flex-col items-center">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-3 border-2 border-myamber">
              <ShieldCheck className="text-myamber w-8 h-8" />
            </div>
            <h1 className="font-bold text-xl tracking-wide">BAL NOVA</h1>
            <p className="text-xs text-myamber/80 mb-3">
              Vendor Portal <span className="bg-white/20 px-1 rounded text-[10px] ml-1">TIER {tier}</span>
            </p>
          </Link>
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

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 md:p-6 scroll-smooth">
          {activeTab === "dashboard" ? (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gradient-to-r from-myblue to-myamber rounded-xl p-5 shadow-lg text-white">
                  <div className="text-xs font-bold opacity-80 uppercase tracking-wider mb-1">Escrow Balance</div>
                  <div className="text-2xl font-black">{formatCurrency(escrowBalance)}</div>
                  <div className="text-[10px] mt-1 opacity-70">Escrow releases 14 days after delivery</div>
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
                  onClick={requestPickup}
                  className="bg-myblue hover:bg-blue-900 text-white font-semibold py-2.5 px-5 rounded-lg shadow-sm transition-transform active:scale-95 flex items-center gap-2"
                >
                  <Bike className="w-4 h-4" /> Request Pickup
                </button>
                <Link
                  href={storefrontLink}
                  className="bg-white text-myblue font-semibold py-2.5 px-5 rounded-lg shadow-sm transition-transform active:scale-95 flex items-center gap-2"
                >
                  Open Store Link
                </Link>
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-gray-400 uppercase">Weekly Sales Pulse</div>
                      <div className="text-sm text-gray-500">Simple view of vendor activity.</div>
                    </div>
                    <div className="text-xs text-myamber font-bold">Graph enabled</div>
                  </div>
                  <div className="mt-5 grid grid-cols-7 items-end gap-2 h-28">
                    {weeklySalesBars.map((value, index) => (
                      <div key={index} className="rounded-t bg-myamber/80" style={{ height: `${Math.max(10, value / 4)}px` }} />
                    ))}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="text-xs font-semibold text-gray-400 uppercase">Fulfilment + Withdrawals</div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-[11px] font-bold text-gray-500 mb-2">Pickup mode</div>
                      <div className="flex gap-2">
                        {[
                          { key: "self-drop", label: "Self drop" },
                          { key: "bal-pickup", label: "We pick up" }
                        ].map((option) => (
                          <button
                            key={option.key}
                            onClick={() => persistPickupMode(option.key as "self-drop" | "bal-pickup")}
                            className={cn(
                              "rounded-full px-3 py-2 text-xs font-bold border",
                              pickupMode === option.key ? "border-myamber bg-myamber/10 text-myamber" : "border-gray-200 dark:border-gray-700"
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-gray-500 mb-2">Withdrawal schedule</div>
                      <div className="flex gap-2">
                        {(["daily", "weekly", "monthly"] as const).map((option) => (
                          <button
                            key={option}
                            onClick={() => persistWithdrawSchedule(option)}
                            className={cn(
                              "rounded-full px-3 py-2 text-xs font-bold border capitalize",
                              withdrawSchedule === option ? "border-myamber bg-myamber/10 text-myamber" : "border-gray-200 dark:border-gray-700"
                            )}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 p-3 text-xs text-gray-500">
                    Withdrawals are approved only after 14-day escrow maturity, completed delivery, and a clean QC status.
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
                  <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    {editableProductId === p.id ? (
                      <div className="space-y-2">
                        <input
                          value={newProductName}
                          onChange={(e) => setNewProductName(e.target.value)}
                          className="w-full rounded border p-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                          placeholder="Product name"
                        />
                        <input
                          value={newProductPrice}
                          onChange={(e) => setNewProductPrice(e.target.value)}
                          className="w-full rounded border p-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                          placeholder="Price"
                        />
                        <input
                          value={newProductBrand}
                          onChange={(e) => setNewProductBrand(e.target.value)}
                          className="w-full rounded border p-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                          placeholder="Brand"
                        />
                        <input
                          value={newProductStock}
                          onChange={(e) => setNewProductStock(e.target.value)}
                          className="w-full rounded border p-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                          placeholder="Stock"
                        />
                        <textarea
                          value={newProductDesc}
                          onChange={(e) => setNewProductDesc(e.target.value)}
                          className="w-full rounded border p-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                          placeholder="Product description"
                          rows={4}
                        />
                        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-3">
                          <label className="text-[11px] font-bold text-gray-500">Product picture</label>
                          <input
                            type="file"
                            accept="image/*"
                            className="mt-2 block w-full text-xs"
                            onChange={(e) => setEditProductImageFile(e.target.files?.[0] || null)}
                          />
                          <div className="mt-2 text-[11px] text-gray-500">
                            {editProductImageFile ? editProductImageFile.name : editProductImageUrl ? "Current image saved" : "No image selected"}
                          </div>
                          {editProductImagePreview || editProductImageUrl ? (
                            <img
                              src={editProductImagePreview || editProductImageUrl}
                              alt={p.name}
                              className="mt-3 h-32 w-full rounded-lg object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : null}
                          {editProductImageUrl ? (
                            <button
                              onClick={() => {
                                setEditProductImageUrl("")
                                setEditProductImageFile(null)
                              }}
                              className="mt-2 text-[11px] font-bold text-red-500"
                            >
                              Remove current image
                            </button>
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              if (editProductImageFile && editProductImageFile.size > 5 * 1024 * 1024) {
                                await dialog.alert("Image is too large. Please use a file under 5MB.")
                                return
                              }

                              setProductSaving(true)
                              try {
                                let imageUrl = editProductImageUrl || null
                                if (editProductImageFile) {
                                  imageUrl = await uploadImage(editProductImageFile)
                                }
                                const updated = {
                                  id: p.id,
                                  name: newProductName || p.name,
                                  brand: newProductBrand.trim() || null,
                                  price: Number(newProductPrice || p.price),
                                  baseStock: Number(newProductStock || p.baseStock || 0),
                                  desc: newProductDesc.trim() || null,
                                  imageUrl
                                }
                                const res = await fetch("/api/inventory", {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify(updated)
                                })
                                const data = (await res.json().catch(() => ({}))) as { item?: Product; error?: string }
                                if (!res.ok) {
                                  throw new Error(data.error || "Could not update this product yet.")
                                }
                                if (data.item) {
                                  setProducts((prev) => prev.map((item) => (item.id === p.id ? data.item! : item)))
                                } else {
                                  await syncInventory()
                                }
                                resetEditableForm()
                              } catch (error) {
                                await dialog.alert(error instanceof Error ? error.message : "Could not update this product yet.")
                              } finally {
                                setProductSaving(false)
                              }
                            }}
                            className="text-xs font-bold bg-myamber text-myblue px-3 py-2 rounded"
                          >
                            {productSaving ? "Saving..." : "Save"}
                          </button>
                          <button onClick={resetEditableForm} className="text-xs font-bold border px-3 py-2 rounded">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="mb-3 h-36 w-full rounded-lg object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="mb-3 flex h-36 w-full items-center justify-center rounded-lg border border-dashed border-gray-200 text-xs text-gray-400 dark:border-gray-700">
                            No product image yet
                          </div>
                        )}
                        <div className="font-bold">{p.name}</div>
                        {p.brand ? <div className="text-xs text-gray-500">{p.brand}</div> : null}
                        <div className="text-xs text-gray-400">Stock: {p.baseStock || 0}</div>
                        <div className="text-sm text-myamber font-bold">{formatCurrency(p.price)}</div>
                        {p.desc ? <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-300">{p.desc}</p> : null}
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => {
                              setEditableProductId(p.id)
                              setNewProductName(p.name)
                              setNewProductBrand(p.brand || "")
                              setNewProductPrice(String(p.price))
                              setNewProductStock(String(p.baseStock || 0))
                              setNewProductDesc(p.desc || "")
                              setEditProductImageUrl(p.imageUrl || "")
                              setEditProductImageFile(null)
                              setEditProductImagePreview(null)
                            }}
                            className="text-xs font-bold border border-blue-500/40 text-blue-600 px-3 py-2 rounded"
                          >
                            Edit
                          </button>
                          <button className="text-xs font-bold border border-emerald-500/40 text-emerald-600 px-3 py-2 rounded">
                            Live to sell
                          </button>
                        </div>
                      </>
                    )}
                  </div>
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
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-sm">
                <div className="font-bold">Structured withdrawals</div>
                <p className="mt-1 text-xs text-gray-500">
                  Current plan: {withdrawSchedule}. Escrow unlocks after 14 days, then approval checks completed delivery, pickup confirmation, and no active dispute.
                </p>
              </div>
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
                <label className="text-xs font-bold text-gray-500">Public Contact Email</label>
                <input
                  value={profile.contactEmail || ""}
                  onChange={(e) => setProfile((p) => ({ ...p, contactEmail: e.target.value }))}
                  className="w-full p-2 rounded border dark:bg-gray-900 dark:border-gray-700"
                />
                <label className="text-xs font-bold text-gray-500">Public Contact Phone</label>
                <input
                  value={profile.contactPhone || ""}
                  onChange={(e) => setProfile((p) => ({ ...p, contactPhone: e.target.value }))}
                  className="w-full p-2 rounded border dark:bg-gray-900 dark:border-gray-700"
                />
                <label className="text-xs font-bold text-gray-500">Business Address</label>
                <input
                  value={profile.businessAddress || ""}
                  onChange={(e) => setProfile((p) => ({ ...p, businessAddress: e.target.value }))}
                  className="w-full p-2 rounded border dark:bg-gray-900 dark:border-gray-700"
                />
                <label className="text-xs font-bold text-gray-500">Vendor Bio</label>
                <textarea
                  value={profile.bio || ""}
                  onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                  className="w-full p-2 rounded border dark:bg-gray-900 dark:border-gray-700"
                  rows={4}
                />
                <button
                  onClick={() => void saveVendorProfile()}
                  disabled={profileSaving}
                  className="text-xs font-bold bg-myblue text-white px-3 py-2 rounded disabled:opacity-60"
                >
                  {profileSaving ? "Saving..." : "Save Vendor Profile"}
                </button>
                {profileMessage ? <div className="text-xs text-gray-500">{profileMessage}</div> : null}
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
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-xs">
                  <div className="font-bold text-gray-500 mb-1">Storefront link</div>
                  <div className="break-all text-myamber">{storefrontLink}</div>
                </div>
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
                      onClick={() => void saveVendorProfile(t)}
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
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1 mt-3">Brand</label>
            <input
              value={newProductBrand}
              onChange={(e) => setNewProductBrand(e.target.value)}
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
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1 mt-3">Description</label>
            <textarea
              value={newProductDesc}
              onChange={(e) => setNewProductDesc(e.target.value)}
              className="w-full p-3 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              rows={4}
            />
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1 mt-3">Product Picture</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setNewProductImageFile(e.target.files?.[0] || null)}
              className="w-full p-3 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
            <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              {newProductImageFile ? newProductImageFile.name : "No image selected"}
            </div>
            {newProductImagePreview ? (
              <img
                src={newProductImagePreview}
                alt="New product preview"
                className="mt-3 h-40 w-full rounded-xl object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : null}
            <button
              onClick={saveNewProduct}
              disabled={productSaving}
              className="w-full mt-4 bg-myamber text-myblue py-3 rounded-xl font-bold"
            >
              {productSaving ? "Saving..." : "Save Product"}
            </button>
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


