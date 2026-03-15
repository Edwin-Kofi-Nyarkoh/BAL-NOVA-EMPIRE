
// app/customer/page.tsx
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import {
  ShoppingCart,
  MapPin,
  User,
  Search,
  MessageCircle,
  Moon,
  Sun,
  WandSparkles,
  Bolt,
  PhoneCall
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { getJSON, postJSON, requestJSON } from "@/lib/sync"
import { LogoutButton } from "@/components/logout-button"
import { useDialog } from "@/components/ui/dialog-service"

type Product = {
  id: string
  name: string
  price: number
  brand?: string
  image?: string
  desc?: string
}

type CartItem = Product & { qty: number; productId?: string | null; cartItemId?: string }

type Order = {
  id: string
  item: string
  status: string
  price: number
  createdAt: string
}

type Address = {
  id: string
  label: string
  note?: string
}

type Chat = {
  id: string
  role: "user" | "ai" | "admin"
  text: string
  createdAt: string
}

type Pro = {
  id: string
  name?: string | null
  summary?: string | null
  teamCount?: number
}

type CustomerProfile = {
  name: string
  phone?: string
}

const TABS = ["shop", "service", "orders", "chats", "locations", "cart", "profile"] as const

type Tab = typeof TABS[number]

type ServiceView = "panic" | "post" | "browse"

export default function CustomerHome() {
  const { data: session, status: sessionStatus } = useSession()
  const sessionRole = ((session?.user as any)?.role || "") as string
  const dialog = useDialog()
  const [tab, setTab] = useState<Tab>("shop")
  const [mode, setMode] = useState<"shop" | "service">("shop")
  const [serviceView, setServiceView] = useState<ServiceView>("panic")
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])
  const [profile, setProfile] = useState<CustomerProfile>({ name: "" })
  const [deliveryMode, setDeliveryMode] = useState<"delivery" | "pickup">("delivery")
  const [deliveryLoc, setDeliveryLoc] = useState("")
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [chats, setChats] = useState<Chat[]>([])
  const [universalChats, setUniversalChats] = useState<Chat[]>([])
  const [pros, setPros] = useState<Pro[]>([])
  const [aiForYou, setAiForYou] = useState<string[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [panicType, setPanicType] = useState<string>("")
  const [panicStatus, setPanicStatus] = useState<string>("")
  const [panicResults, setPanicResults] = useState<string[]>([])
  const [isDark, setIsDark] = useState(false)
  const [region, setRegion] = useState("GH")
  const [apiKey, setApiKey] = useState("")
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [serviceDesc, setServiceDesc] = useState("")
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [addressLabel, setAddressLabel] = useState("")
  const [addressNote, setAddressNote] = useState("")
  const [showProductModal, setShowProductModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showNovaAssistant, setShowNovaAssistant] = useState(false)
  const [novaPrompt, setNovaPrompt] = useState("")
  const [novaResponse, setNovaResponse] = useState("")
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    void syncInventory()
    void syncOrders()
    void syncChats()
    void syncProfile()
    void syncSettings()
    void syncAddresses()
    void syncCart()
    void syncPros()
  }, [])

  useEffect(() => {
    const paid = searchParams.get("paid")
    if (paid === "1") {
      setShowPaymentSuccess(true)
    }
  }, [searchParams])

  const chatStreamRef = useRef<EventSource | null>(null)
  const chatSinceRef = useRef<string>("")

  useEffect(() => {
    if (tab !== "chats") {
      if (chatStreamRef.current) {
        chatStreamRef.current.close()
        chatStreamRef.current = null
      }
      return
    }
    if (chatStreamRef.current) return

    const since = chatSinceRef.current || new Date(Date.now() - 60 * 1000).toISOString()
    const es = new EventSource(`/api/chats/stream?since=${encodeURIComponent(since)}`)
    chatStreamRef.current = es

    es.addEventListener("chats", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data || "{}")
        const incoming = Array.isArray(payload?.messages) ? payload.messages : []
        if (!incoming.length) return
        const last = incoming[incoming.length - 1]
        if (last?.createdAt) {
          chatSinceRef.current = last.createdAt
        }
        setChats((prev) => {
          const seen = new Set(prev.map((m) => m.id))
          const merged = [...prev]
          for (const msg of incoming) {
            if (!seen.has(msg.id)) merged.push(msg)
          }
          return merged
        })
      } catch {
        // ignore bad payload
      }
    })

    es.onerror = () => {
      if (chatStreamRef.current) {
        chatStreamRef.current.close()
        chatStreamRef.current = null
      }
      const retry = setTimeout(() => {
        if (tab === "chats") {
          chatStreamRef.current = null
          const next = new EventSource(`/api/chats/stream?since=${encodeURIComponent(chatSinceRef.current || new Date(Date.now() - 60 * 1000).toISOString())}`)
          chatStreamRef.current = next
        }
      }, 6000)
      return () => clearTimeout(retry)
    }

    return () => {
      if (chatStreamRef.current) {
        chatStreamRef.current.close()
        chatStreamRef.current = null
      }
    }
  }, [tab])

  async function syncInventory() {
    const data = await getJSON<{ items: Product[] }>("/api/inventory", { items: [] })
    setProducts(Array.isArray(data.items) ? data.items : [])
  }

  async function syncOrders() {
    const data = await getJSON<{ orders: Order[] }>("/api/orders", { orders: [] })
    setOrders(Array.isArray(data.orders) ? data.orders : [])
  }

  async function syncChats() {
    const data = await getJSON<{ chats: Chat[] }>("/api/chats", { chats: [] })
    const nextChats = Array.isArray(data.chats) ? data.chats : []
    setChats(nextChats)
    const last = nextChats[nextChats.length - 1]
    if (last?.createdAt) {
      chatSinceRef.current = last.createdAt
    }
  }

  async function syncProfile() {
    const data = await getJSON<{ user?: { name?: string | null; email?: string | null } }>("/api/profile", {})
    const name = data.user?.name || data.user?.email || ""
    setProfile((prev) => ({ ...prev, name }))
  }

  async function syncSettings() {
    const data = await getJSON<{ settings?: { theme?: string; region?: string; phone?: string; apiKey?: string } }>(
      "/api/settings",
      {}
    )
    if (data.settings?.region) setRegion(data.settings.region)
    if (data.settings?.apiKey) setApiKey(data.settings.apiKey)
    if (data.settings?.phone) setProfile((prev) => ({ ...prev, phone: data.settings?.phone }))

    const theme = data.settings?.theme || "light"
    const dark = theme === "dark"
    setIsDark(dark)
    document.documentElement.classList.toggle("dark", dark)
  }

  async function syncAddresses() {
    const data = await getJSON<{ addresses?: Address[] }>("/api/addresses", {})
    setAddresses(Array.isArray(data.addresses) ? data.addresses : [])
  }

  async function syncPros() {
    const data = await getJSON<{ pros?: Pro[] }>("/api/pros", {})
    setPros(Array.isArray(data.pros) ? data.pros : [])
  }

  async function syncCart() {
    const data = await getJSON<{ items?: { id: string; productId?: string | null; name: string; price: number; qty: number }[] }>(
      "/api/cart",
      {}
    )
    const items = Array.isArray(data.items) ? data.items : []
    setCart(
      items.map((i) => ({
        id: i.productId || i.id,
        productId: i.productId || null,
        cartItemId: i.id,
        name: i.name,
        price: i.price,
        qty: i.qty
      }))
    )
  }

  function notifyCartUpdate() {
    window.dispatchEvent(new Event("cart:updated"))
  }

  function toCartPayload(items: CartItem[]) {
    return items.map((i) => ({
      productId: i.productId || i.id,
      name: i.name,
      price: i.price,
      qty: i.qty
    }))
  }

  const points = useMemo(() => {
    const total = orders.reduce((sum, o) => sum + o.price, 0)
    return Math.round(total / 10)
  }, [orders])

  const cartCount = useMemo(() => cart.reduce((sum, c) => sum + c.qty, 0), [cart])
  const cartTotal = useMemo(() => cart.reduce((sum, c) => sum + c.price * c.qty, 0), [cart])

  useEffect(() => {
    const base = deliveryMode === "pickup" ? 0 : 10
    const variable = deliveryMode === "pickup" ? 0 : Math.min(25, cartTotal * 0.03)
    setDeliveryFee(Number((base + variable).toFixed(2)))
  }, [cartTotal, deliveryMode])

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((p) => p.id === product.id)
      if (existing) {
        const next = prev.map((p) => (p.id === product.id ? { ...p, qty: p.qty + 1 } : p))
        void requestJSON("/api/cart", { items: toCartPayload(next) }, "PUT", {}).then(notifyCartUpdate)
        return next
      }
      const next = [...prev, { ...product, qty: 1, productId: product.id }]
      void requestJSON("/api/cart", { items: toCartPayload(next) }, "PUT", {}).then(notifyCartUpdate)
      return next
    })
  }

  async function openProductDetails(p: Product) {
    setSelectedProduct(p)
    setShowProductModal(true)
  }

  function removeFromCart(productId: string) {
    setCart((prev) => {
      const next = prev.filter((p) => p.id !== productId)
      void requestJSON("/api/cart", { items: toCartPayload(next) }, "PUT", {}).then(notifyCartUpdate)
      return next
    })
  }


  function checkout() {
    if (cart.length === 0) return
    void requestJSON(
      "/api/payments/checkout",
      { source: "customer", deliveryFee },
      "POST",
      {}
    ).then((data: any) => {
      if (data?.link) {
        window.location.href = data.link
      }
    })
  }

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle("dark", next)
    void requestJSON("/api/settings", { theme: next ? "dark" : "light" }, "PUT", {})
  }

  function forceRefreshShop() {
    void syncInventory()
  }

  function toggleShopRegion() {
    const next = region === "GH" ? "NG" : "GH"
    setRegion(next)
    void requestJSON("/api/settings", { region: next }, "PUT", {})
  }

  async function generateAiForYou() {
    if (!apiKey) return
    setAiLoading(true)
    try {
      const recentOrders = orders.slice(0, 3).map((o) => o.item).join(", ")
      const invCtx = products.map((p) => `${p.name} (GHS ${p.price})`).join(", ")
      const prompt = `Suggest 4 items for a Ghana customer. Recent: ${recentOrders || "none"}. Inventory: ${invCtx}.`
      const text = await callGemini(apiKey, prompt)
      const lines = text.split("\n").map((l) => l.replace(/^[-*]\s?/, "").trim()).filter(Boolean)
      setAiForYou(lines.slice(0, 4))
    } finally {
      setAiLoading(false)
    }
  }

  async function askNovaAssistant() {
    if (!apiKey || !novaPrompt.trim()) return
    setAiLoading(true)
    try {
      const text = await callGemini(apiKey, novaPrompt.trim())
      setNovaResponse(text)
    } finally {
      setAiLoading(false)
    }
  }

  async function addAddress() {
    if (!profile.phone) {
      await dialog.alert("Add a phone number in your profile before saving locations.")
      return
    }
    setEditingAddress(null)
    setAddressLabel("")
    setAddressNote("")
    setShowAddressModal(true)
  }

  function editAddress(address: Address) {
    setEditingAddress(address)
    setAddressLabel(address.label)
    setAddressNote(address.note || "")
    setShowAddressModal(true)
  }

  async function saveAddress() {
    const label = addressLabel.trim()
    if (!label) return
    if (editingAddress) {
      await requestJSON(`/api/addresses/${editingAddress.id}`, { label, note: addressNote }, "PATCH", {})
    } else {
      await postJSON("/api/addresses", { label, note: addressNote }, {})
    }
    await syncAddresses()
    setShowAddressModal(false)
  }

  function sendChat(text: string) {
    if (!text.trim()) return
    const newMsg: Chat = { id: `C-${Date.now()}`, role: "user", text, createdAt: new Date().toISOString() }
    setChats((prev) => [...prev, newMsg])
    void postJSON("/api/chats", { chat: newMsg }, { chats: [] })
  }

  function triggerPanicProtocol() {
    if (!panicType) return
    setPanicStatus(`Request sent for ${panicType} assistance in ${region === "GH" ? "Accra" : "Lagos"}.`)
    setPanicResults([])
  }

  async function resetSimulation() {
    const ok = await dialog.confirm("Reset customer simulation data?")
    if (!ok) return
    window.location.reload()
  }

  async function importLegacyCustomerData() {
    const legacyProfile = safeParse<CustomerProfile>("balnova_customer_profile", { name: "", phone: "" })
    const legacyAddresses = safeParse<Address[]>("balnova_customer_addresses", [])
    const legacyCart = safeParse<CartItem[]>("balnova_cart", [])
    const legacyApiKey = localStorage.getItem("gemini_api_key") || ""
    const legacyRegion = localStorage.getItem("balnova_active_region") || ""
    const legacyTheme = localStorage.getItem("cust_theme") || ""

    if (legacyProfile.name) {
      await requestJSON("/api/profile", { name: legacyProfile.name }, "PUT", {})
    }
    await requestJSON(
      "/api/settings",
      {
        phone: legacyProfile.phone || "",
        apiKey: legacyApiKey || "",
        region: legacyRegion || "",
        theme: legacyTheme || ""
      },
      "PUT",
      {}
    )

    for (const addr of legacyAddresses) {
      if (addr?.label) {
        await postJSON("/api/addresses", { label: addr.label, note: addr.note || "" }, {})
      }
    }

    if (legacyCart.length > 0) {
      await requestJSON("/api/cart", { items: toCartPayload(legacyCart) }, "PUT", {})
      notifyCartUpdate()
    }

    await syncProfile()
    await syncSettings()
    await syncAddresses()
    await syncCart()
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-sans h-screen flex flex-col overflow-hidden transition-colors duration-300">
      <header className="bg-mynavy text-white shadow-md z-30 sticky top-0 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setTab("shop")}>
            <div className="w-8 h-8 bg-myamber rounded-full flex items-center justify-center text-mynavy font-bold text-xs">
              BN
            </div>
            <div className="flex flex-col">
              <h1 className="font-bold text-xl tracking-tight leading-none">Bal Nova</h1>
              <div className="text-[10px] text-gray-300">
                Nova Credits: <span className="font-bold text-myamber">{points}</span>
              </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
            {["shop", "service", "orders", "chats"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t as Tab)}
                className={cn("nav-link font-medium hover:text-myamber transition", tab === t && "nav-active-desk")}
              >
                {t === "service" ? "Hire" : t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 md:gap-4">
            {sessionStatus === "authenticated" && sessionRole ? (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-myamber/40 bg-myamber/10 text-myamber text-[10px] font-bold">
                Role: {sessionRole.charAt(0).toUpperCase() + sessionRole.slice(1)}
              </div>
            ) : null}
            <button
              onClick={toggleShopRegion}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-bold border border-gray-200 dark:border-gray-600 transition-all hover:bg-myamber hover:text-mynavy hover:border-myamber active:scale-95"
            >
              <span className="text-base">{region === "GH" ? "GH" : "NG"}</span>{" "}
              <span className="hidden md:inline">{region === "GH" ? "Ghana" : "Nigeria"}</span>
            </button>
            <button
              onClick={forceRefreshShop}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition"
              title="Refresh Products"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setTab("profile")}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition"
            >
              <User className="h-4 w-4" />
            </button>
            <button
              onClick={() => setTab("cart")}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center relative hover:bg-white/20 transition"
            >
              <ShoppingCart className="h-4 w-4" />
              {cartCount > 0 ? (
                <span className="absolute -top-1 -right-1 bg-myamber text-mynavy font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              ) : null}
            </button>
            <LogoutButton className="inline-flex text-xs font-bold px-3 py-2 rounded-full border border-myamber/30 text-myamber hover:bg-myamber/10 transition-colors" />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0 scroll-smooth relative w-full" id="mainContainer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {tab === "shop" || tab === "service" ? (
            <div className="space-y-6">
              {tab === "shop" ? (
                <div className="mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                      <WandSparkles className="text-white h-3 w-3 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base dark:text-white leading-none">Curated For You</h3>
                      <p className="text-[10px] text-gray-400">Based on your taste</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={generateAiForYou}
                      className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                    >
                      {aiLoading ? "Analyzing..." : "Generate"}
                    </button>
                    <button
                      onClick={() => setAiForYou([])}
                      className="text-xs text-gray-400 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {aiForYou.length === 0 ? (
                      <div className="col-span-full p-4 text-center text-xs text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                        Analyzing your purchase history...
                      </div>
                    ) : (
                      aiForYou.map((item) => (
                        <div key={item} className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-sm">
                          {item}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}

              <div className="md:hidden mb-4 flex bg-gray-200 dark:bg-gray-800 p-1 rounded-xl">
                <button
                  onClick={() => {
                    setMode("shop")
                    setTab("shop")
                  }}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                    mode === "shop"
                      ? "bg-white dark:bg-gray-700 shadow-sm text-mynavy dark:text-myamber"
                      : "text-gray-500"
                  )}
                >
                  Shop
                </button>
                <button
                  onClick={() => {
                    setMode("service")
                    setTab("service")
                  }}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                    mode === "service"
                      ? "bg-white dark:bg-gray-700 shadow-sm text-mynavy dark:text-myamber"
                      : "text-gray-500"
                  )}
                >
                  Hire
                </button>
              </div>

              {tab === "shop" ? (
                <div>
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-lg dark:text-white">Trending in Accra</h3>
                      <span className="text-xs text-myamber cursor-pointer hover:underline">View All</span>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                      {products.slice(0, 4).map((p) => (
                        <div
                          key={p.id}
                          className="min-w-[180px] bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700"
                        >
                          <div className="text-xs text-gray-400">{p.brand || "Bal Nova"}</div>
                          <button
                            onClick={() => openProductDetails(p)}
                            className="font-bold text-left hover:text-myamber transition"
                          >
                            {p.name}
                          </button>
                          <div className="text-sm text-myamber font-bold mt-2">{formatCurrency(p.price)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <h3 className="font-bold text-lg dark:text-white mb-3">All Products</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 pb-20">
                    {products.map((p) => (
                      <div
                        key={p.id}
                        className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:border-myamber transition"
                      >
                        <div className="text-xs text-gray-400">{p.brand || "Bal Nova"}</div>
                        <button
                          onClick={() => openProductDetails(p)}
                          className="font-bold text-sm text-left hover:text-myamber transition"
                        >
                          {p.name}
                        </button>
                        <div className="text-sm text-myamber font-bold mt-2">{formatCurrency(p.price)}</div>
                        <button
                          onClick={() => addToCart(p)}
                          className="mt-3 w-full text-xs font-bold bg-mynavy text-white py-2 rounded-lg hover:bg-myblue transition"
                        >
                          Add to Cart
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {tab === "service" ? (
                <div className="space-y-6">
                  <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto pb-1 no-scrollbar">
                    {[
                      { key: "panic", label: "Emergency", color: "text-red-500 border-red-500" },
                      { key: "post", label: "Post Job", color: "text-gray-500" },
                      { key: "browse", label: "Directory", color: "text-gray-500" }
                    ].map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setServiceView(item.key as ServiceView)}
                        className={cn(
                          "whitespace-nowrap pb-2 px-3 border-b-2 text-xs font-bold",
                          serviceView === item.key ? item.color : "border-transparent text-gray-500"
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {serviceView === "panic" ? (
                    <div>
                      <div className="bg-red-50 dark:bg-red-900/10 border-2 border-red-500 rounded-2xl p-6 text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-red-500/5 animate-pulse" />
                        <h2 className="text-2xl font-black text-red-600 dark:text-red-500 mb-2 relative z-10">
                          URGENT ASSISTANCE
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 relative z-10">
                          We broadcast your distress signal to the nearest Top-Rated Pros.
                          <br />
                          <span className="text-xs opacity-75">(GHS 50 Urgency Fee applies)</span>
                        </p>
                        <div className="relative z-10 flex justify-center mb-6">
                          <button
                            onClick={triggerPanicProtocol}
                            className="w-40 h-40 rounded-full bg-gradient-to-br from-red-500 to-red-700 shadow-[0_0_40px_rgba(239,68,68,0.6)] flex flex-col items-center justify-center text-white transition-transform active:scale-95 hover:scale-105 border-4 border-red-400"
                          >
                            <Bolt className="h-10 w-10 mb-2" />
                            <span className="font-bold text-lg">SUMMON</span>
                          </button>
                        </div>
                        <div className="relative z-10 grid grid-cols-3 gap-2 max-w-xs mx-auto">
                          {["Plumber", "Electrician", "Locksmith"].map((label) => (
                            <button
                              key={label}
                              onClick={() => setPanicType(label)}
                              className={cn(
                                "p-2 border border-red-200 dark:border-red-900 rounded bg-white dark:bg-gray-800 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/50",
                                panicType === label && "bg-red-100 dark:bg-red-900/50"
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {panicStatus ? (
                        <div className="mt-6">
                          <div className="flex items-center gap-3 text-sm font-bold text-mynavy dark:text-white mb-2">
                            <PhoneCall className="h-4 w-4 animate-pulse" />
                            <span>{panicStatus}</span>
                          </div>
                          <div className="space-y-2">
                            {panicResults.map((r) => (
                              <div key={r} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700 text-xs">
                                {r}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {serviceView === "post" ? (
                    <div className="bg-gradient-to-r from-blue-600 to-mynavy p-6 rounded-2xl shadow-lg mb-8 text-white relative overflow-hidden">
                      <div className="relative z-10">
                        <h2 className="text-2xl font-bold mb-2">Post a Standard Job</h2>
                        <p className="text-blue-100 mb-4 text-sm">Get quotes within 24 hours. Free to post.</p>
                        <button
                          onClick={() => setShowServiceModal(true)}
                          className="bg-white text-mynavy px-6 py-2 rounded-full font-bold shadow hover:bg-gray-100 transition text-sm"
                        >
                          Create Listing
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {serviceView === "browse" ? (
                    <div>
                      <h3 className="font-bold mb-4 text-xl dark:text-white">Verified Pros</h3>
                      {pros.length === 0 ? (
                        <div className="text-sm text-gray-500">No verified pros available yet.</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {pros.map((p) => (
                            <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                              <div className="font-bold">{p.name || "Verified Pro"}</div>
                              <div className="text-xs text-gray-400">{p.summary || "No profile summary yet."}</div>
                              {typeof p.teamCount === "number" ? (
                                <div className="text-[10px] text-gray-400 mt-2">Team size: {p.teamCount}</div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "orders" ? (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 dark:text-white">My Orders</h2>
              <div className="space-y-4">
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
                            o.status === "Paid"
                              ? "bg-emerald-500/15 text-emerald-600"
                              : "bg-amber-500/15 text-amber-600"
                          }`}
                        >
                          {o.status}
                        </span>
                      </div>
                      {o.status !== "Paid" ? (
                        <button
                          onClick={() => {
                            void requestJSON("/api/payments/checkout-order", { orderId: o.id }, "POST", {}).then((data: any) => {
                              if (data?.link) {
                                window.location.href = data.link
                              }
                            })
                          }}
                          className="mt-3 text-xs font-bold px-3 py-2 rounded-full border border-myamber/40 text-myamber hover:bg-myamber/10 transition-colors"
                        >
                          Pay Now
                        </button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {tab === "locations" ? (
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold dark:text-white">Saved Locations</h2>
                <button onClick={addAddress} className="bg-mynavy text-white px-4 py-2 rounded-lg font-bold text-sm shadow">
                  + New
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {addresses.length === 0 ? (
                    <div className="text-sm text-gray-500">No saved locations yet.</div>
                  ) : (
                    addresses.map((a) => (
                      <div
                        key={a.id}
                        className="text-left bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:border-myamber transition"
                      >
                        <button
                          onClick={() => {
                            setDeliveryLoc(a.label)
                            setTab("cart")
                          }}
                          className="w-full text-left"
                        >
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-myamber" />
                            <div className="font-bold">{a.label}</div>
                          </div>
                          {a.note ? <div className="text-xs text-gray-400 mt-1">{a.note}</div> : null}
                        </button>
                        <div className="pt-2">
                          <button
                            onClick={() => editAddress(a)}
                            className="text-xs text-myamber mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => requestJSON(`/api/addresses/${a.id}`, {}, "DELETE", {}).then(() => syncAddresses())}
                            className="text-xs text-red-500"
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

          {tab === "cart" ? (
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 dark:text-white">Shopping Cart</h2>
              <div className="mb-4">
                <button
                  onClick={() => (window.location.href = "/customer/cart")}
                  className="text-xs font-bold bg-gray-100 text-gray-700 px-3 py-2 rounded"
                >
                  Manage Cart
                </button>
              </div>
              <div className="divide-y dark:divide-gray-700 mb-6">
                {cart.length === 0 ? (
                  <div className="text-sm text-gray-500 py-4">Your cart is empty.</div>
                ) : (
                  cart.map((c) => (
                    <div key={c.id} className="py-3 flex justify-between items-center">
                      <div>
                        <div className="font-bold">{c.name}</div>
                        <div className="text-xs text-gray-400">Qty: {c.qty}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="font-bold text-myamber">{formatCurrency(c.price * c.qty)}</div>
                        <button onClick={() => removeFromCart(c.id)} className="text-xs text-red-400 hover:underline">Remove</button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2 p-1 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4">
                <button
                  onClick={() => setDeliveryMode("delivery")}
                  className={cn(
                    "flex-1 py-2 rounded-md text-xs font-bold transition-all",
                    deliveryMode === "delivery"
                      ? "bg-white dark:bg-gray-600 shadow-sm text-mynavy dark:text-white"
                      : "text-gray-500 dark:text-gray-400"
                  )}
                >
                  Delivery
                </button>
                <button
                  onClick={() => setDeliveryMode("pickup")}
                  className={cn(
                    "flex-1 py-2 rounded-md text-xs font-bold transition-all",
                    deliveryMode === "pickup"
                      ? "bg-white dark:bg-gray-600 shadow-sm text-mynavy dark:text-white"
                      : "text-gray-500 dark:text-gray-400"
                  )}
                >
                  Pickup
                </button>
              </div>

              {deliveryMode === "delivery" ? (
                <div className="mb-4">
                  <div className="flex justify-between items-end mb-1">
                    <label className="block text-xs font-bold text-gray-500">Delivery Location</label>
                    <button
                      onClick={() => setTab("locations")}
                      className="text-[10px] text-myamber font-bold hover:underline"
                    >
                      <MapPin className="h-3 w-3 inline-block mr-1" /> Select Saved
                    </button>
                  </div>
                  <input
                    type="text"
                    value={deliveryLoc}
                    onChange={(e) => setDeliveryLoc(e.target.value)}
                    placeholder="e.g. East Legon, near ANC Mall"
                    className="w-full p-3 rounded-lg border dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                  />
                </div>
              ) : null}

              <div className="border-t dark:border-gray-700 pt-4 mt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-500 text-sm">Delivery Fee</span>
                  <span className="font-bold text-sm dark:text-white">{formatCurrency(deliveryFee)}</span>
                </div>
                <div className="flex justify-between items-center mb-6">
                  <span className="font-bold text-xl dark:text-white">Total</span>
                  <span className="font-bold text-xl text-myamber">
                    {formatCurrency(cartTotal + deliveryFee)}
                  </span>
                </div>
                <button
                  onClick={checkout}
                  disabled={cart.length === 0}
                  className="w-full bg-mynavy text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-myblue transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Checkout
                </button>
              </div>
            </div>
          ) : null}

          {tab === "profile" ? (
            <div className="max-w-lg mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 text-center mb-6">
                <div className="w-20 h-20 bg-mynavy text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-3">
                  <User className="h-8 w-8" />
                </div>
                <div className="space-y-4 text-left">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">My Name</label>
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                      className="w-full p-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Phone Number (ID)</label>
                    <input
                      type="tel"
                      value={profile.phone || ""}
                      onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="+233..."
                      className="w-full p-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono"
                    />
                    <p className="text-[9px] text-gray-400 mt-1">Used for verified delivery locations.</p>
                  </div>
                  <div className="pt-4 border-t dark:border-gray-700">
                    <label className="text-xs font-bold text-gray-500">Gemini API Key</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full p-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <button
                      onClick={async () => {
                        await requestJSON("/api/profile", { name: profile.name }, "PUT", {})
                        await requestJSON("/api/settings", { phone: profile.phone || "", apiKey }, "PUT", {})
                      }}
                      className="w-full mt-3 bg-mynavy text-white py-3 rounded-xl font-bold shadow-md hover:bg-myblue transition"
                    >
                      Save Profile
                    </button>
                    <button
                      onClick={importLegacyCustomerData}
                      className="w-full mt-2 bg-gray-100 text-gray-700 py-2 rounded-xl text-xs font-bold"
                    >
                      Import Legacy Local Data
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={resetSimulation}
                className="w-full py-3 bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold hover:bg-red-200 transition"
              >
                Reset Simulation Data
              </button>
            </div>
          ) : null}

          {tab === "chats" ? (
            <div className="max-w-lg mx-auto">
              <h2 className="text-2xl font-bold mb-6 dark:text-white">Messages</h2>
              <div className="flex flex-col gap-2">
                {chats.length === 0 ? (
                  <div className="text-sm text-gray-500">No messages yet.</div>
                ) : (
                  chats.map((c) => (
                    <div
                      key={c.id}
                      className={cn(
                        "chat-bubble",
                        c.role === "user" ? "chat-user" : c.role === "admin" ? "chat-admin" : "chat-ai"
                      )}
                    >
                      {c.text}
                    </div>
                  ))
                )}
              </div>
              <ChatInput onSend={sendChat} />
            </div>
          ) : null}
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-mynavy border-t border-gray-200 dark:border-white/10 px-6 py-3 z-50">
        <div className="flex justify-between items-center max-w-md mx-auto">
          {[
            { key: "shop", label: "Home" },
            { key: "locations", label: "Places" },
            { key: "orders", label: "Orders" },
            { key: "profile", label: "Me" }
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key as Tab)}
              className={cn(
                "flex flex-col items-center gap-1 transition-colors text-gray-400",
                tab === item.key && "nav-active-mobile"
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-tight">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <button
        onClick={() => setTab("chats")}
        className="fixed bottom-24 right-6 z-50 w-14 h-14 bg-myamber text-mynavy rounded-full shadow-2xl flex items-center justify-center genie-float group"
      >
        *
      </button>

      <button
        onClick={() => setShowNovaAssistant(true)}
        className="fixed bottom-24 left-6 z-50 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center"
        title="Nova Assistant"
      >
        <WandSparkles className="h-5 w-5" />
      </button>

      {showAddressModal ? (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg dark:text-white">
                {editingAddress ? "Edit Address" : "Add Address"}
              </h3>
              <button onClick={() => setShowAddressModal(false)} className="text-gray-400 text-xl">
                x
              </button>
            </div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Label</label>
            <input
              value={addressLabel}
              onChange={(e) => setAddressLabel(e.target.value)}
              placeholder="e.g. East Legon"
              className="w-full p-3 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1 mt-3">Note</label>
            <textarea
              value={addressNote}
              onChange={(e) => setAddressNote(e.target.value)}
              rows={3}
              placeholder="Gate color, landmark, etc."
              className="w-full p-3 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
            <button
              onClick={saveAddress}
              className="w-full mt-4 bg-mynavy text-white py-3 rounded-xl font-bold"
            >
              {editingAddress ? "Save Changes" : "Save Address"}
            </button>
          </div>
        </div>
      ) : null}

      {showServiceModal ? (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg dark:text-white">Request Service</h3>
              <button onClick={() => setShowServiceModal(false)} className="text-gray-400 text-xl">x</button>
            </div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Job Description</label>
            <textarea
              value={serviceDesc}
              onChange={(e) => setServiceDesc(e.target.value)}
              className="w-full p-3 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              rows={3}
              placeholder="Describe your issue..."
            />
            <button
              onClick={() => {
                setShowServiceModal(false)
                setServiceDesc("")
              }}
              className="w-full mt-4 bg-mynavy text-white py-3 rounded-xl font-bold"
            >
              Submit Request
            </button>
          </div>
        </div>
      ) : null}

      {showProductModal && selectedProduct ? (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg dark:text-white">Product Details</h3>
              <button onClick={() => setShowProductModal(false)} className="text-gray-400 text-xl">x</button>
            </div>
            <div className="text-xs text-gray-400">{selectedProduct.brand || "Bal Nova"}</div>
            <div className="font-bold text-lg">{selectedProduct.name}</div>
            {selectedProduct.desc ? <div className="text-sm text-gray-500 mt-1">{selectedProduct.desc}</div> : null}
            <div className="text-sm text-myamber font-bold mt-2">{formatCurrency(selectedProduct.price)}</div>
            <button
              onClick={() => addToCart(selectedProduct)}
              className="mt-4 w-full text-xs font-bold bg-mynavy text-white py-2 rounded-lg hover:bg-myblue transition"
            >
              Add to Cart
            </button>
          </div>
        </div>
      ) : null}

      {showNovaAssistant ? (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg dark:text-white">Nova Assistant</h3>
              <button onClick={() => setShowNovaAssistant(false)} className="text-gray-400 text-xl">x</button>
            </div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Ask Nova</label>
            <textarea
              value={novaPrompt}
              onChange={(e) => setNovaPrompt(e.target.value)}
              rows={3}
              className="w-full p-3 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              placeholder="Ask for product recommendations or delivery tips"
            />
            <button
              onClick={askNovaAssistant}
              className="w-full mt-3 bg-mynavy text-white py-2 rounded-lg text-xs font-bold"
            >
              {aiLoading ? "Thinking..." : "Ask Nova"}
            </button>
            {novaResponse ? (
              <div className="mt-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {novaResponse}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showPaymentSuccess ? (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center border-t-4 border-green-500">
            <h3 className="text-lg font-bold text-green-600 mb-2">Payment Successful!</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Your order has been confirmed and is now processing.
            </p>
            <button
              onClick={() => setShowPaymentSuccess(false)}
              className="w-full py-2 bg-mynavy text-white rounded-xl font-bold"
            >
              Close
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


