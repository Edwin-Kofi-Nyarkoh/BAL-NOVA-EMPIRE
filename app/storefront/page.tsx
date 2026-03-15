// app/storefront/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { ShoppingCart, Search, Sun, Moon, Tag } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { getJSON, requestJSON } from "@/lib/sync"
import { LogoutButton } from "@/components/logout-button"
import { useDialog } from "@/components/ui/dialog-service"
import Link from "next/link"

type Product = {
  id: string
  name: string
  price: number
  desc?: string
  brand?: string
  imageUrl?: string
}

type CartItem = Product & { qty: number; productId?: string | null; cartItemId?: string }

type StoreBrand = {
  name: string
  tagline: string
}

type CartSnapshot = {
  id: string
  name: string
  createdAt: string
  items: { id: string; productId?: string | null; name: string; price: number; qty: number }[]
}

export default function StorefrontPage() {
  const dialog = useDialog()
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [snapshots, setSnapshots] = useState<CartSnapshot[]>([])
  const [brand, setBrand] = useState<StoreBrand>({ name: "", tagline: "Official Reseller" })
  const [isDark, setIsDark] = useState(false)
  const [query, setQuery] = useState("")
  const [showSuccess, setShowSuccess] = useState(false)
  const [isAuthed, setIsAuthed] = useState(false)
  const [authPrompt, setAuthPrompt] = useState(false)

  useEffect(() => {
    void syncInventory()
    void checkAuth()
  }, [])

  async function checkAuth() {
    try {
      const res = await fetch("/api/me")
      if (res.ok) {
        setIsAuthed(true)
        void syncBrand()
        void syncSettings()
        void syncCart()
        void syncSnapshots()
      } else {
        setIsAuthed(false)
        setBrand({ name: "Bal Nova Storefront", tagline: "Official Reseller" })
      }
    } catch {
      setIsAuthed(false)
      setBrand({ name: "Bal Nova Storefront", tagline: "Official Reseller" })
    }
  }

  async function syncInventory() {
    const data = await getJSON<{ items: Product[] }>("/api/inventory", { items: [] })
    setProducts(Array.isArray(data.items) ? data.items : [])
  }

  async function syncBrand() {
    const data = await getJSON<{ brand?: { name: string; tagline: string } | null }>("/api/reseller/brand", {})
    if (data.brand) {
      setBrand({ name: data.brand.name, tagline: data.brand.tagline })
      return
    }
    const me = await getJSON<{ user?: { name?: string | null; email?: string | null } }>("/api/me", {})
    const name = me.user?.name || me.user?.email || "Bal Nova Storefront"
    setBrand({ name, tagline: "Official Reseller" })
    void requestJSON("/api/reseller/brand", { name, tagline: "Official Reseller", tier: 1 }, "PUT", {})
  }

  async function syncSettings() {
    const data = await getJSON<{ settings?: { theme?: string } }>("/api/settings", {})
    const dark = data.settings?.theme === "dark"
    setIsDark(dark)
    document.documentElement.classList.toggle("dark", dark)
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

  async function syncSnapshots() {
    const data = await getJSON<{ snapshots?: CartSnapshot[] }>("/api/cart/snapshots", {})
    setSnapshots(Array.isArray(data.snapshots) ? data.snapshots : [])
  }

  function toCartPayload(items: CartItem[]) {
    return items.map((i) => ({
      productId: i.productId || i.id,
      name: i.name,
      price: i.price,
      qty: i.qty
    }))
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return products
    const q = query.toLowerCase()
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.brand || "").toLowerCase().includes(q))
  }, [products, query])

  const total = useMemo(() => cart.reduce((sum, c) => sum + c.price * c.qty, 0), [cart])
  const cartCount = useMemo(() => cart.reduce((sum, c) => sum + c.qty, 0), [cart])

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("store_theme", next ? "dark" : "light")
    if (isAuthed) {
      void requestJSON("/api/settings", { theme: next ? "dark" : "light" }, "PUT", {})
    }
  }

  function addToCart(product: Product) {
    if (!isAuthed) {
      setAuthPrompt(true)
      return
    }
    setCart((prev) => {
      const existing = prev.find((p) => p.id === product.id)
      if (existing) {
        const next = prev.map((p) => (p.id === product.id ? { ...p, qty: p.qty + 1 } : p))
        void requestJSON("/api/cart", { items: toCartPayload(next) }, "PUT", {}).then(() => {
          window.dispatchEvent(new Event("cart:updated"))
        })
        return next
      }
      const next = [...prev, { ...product, qty: 1, productId: product.id }]
      void requestJSON("/api/cart", { items: toCartPayload(next) }, "PUT", {}).then(() => {
        window.dispatchEvent(new Event("cart:updated"))
      })
      return next
    })
  }

  function updateQty(id: string, delta: number) {
    if (!isAuthed) {
      setAuthPrompt(true)
      return
    }
    setCart((prev) => {
      const next = prev
        .map((p) => (p.id === id ? { ...p, qty: Math.max(1, p.qty + delta) } : p))
        .filter((p) => p.qty > 0)
      void requestJSON("/api/cart", { items: toCartPayload(next) }, "PUT", {}).then(() => {
        window.dispatchEvent(new Event("cart:updated"))
      })
      return next
    })
  }

  function removeItem(id: string) {
    if (!isAuthed) {
      setAuthPrompt(true)
      return
    }
    setCart((prev) => {
      const next = prev.filter((p) => p.id !== id)
      void requestJSON("/api/cart", { items: toCartPayload(next) }, "PUT", {}).then(() => {
        window.dispatchEvent(new Event("cart:updated"))
      })
      return next
    })
  }

  function clearCart() {
    if (!isAuthed) {
      setAuthPrompt(true)
      return
    }
    setCart([])
    void requestJSON("/api/cart", {}, "DELETE", {}).then(() => {
      window.dispatchEvent(new Event("cart:updated"))
    })
  }

  function checkout() {
    if (!isAuthed) {
      setAuthPrompt(true)
      return
    }
    if (cart.length === 0) return
    void requestJSON("/api/payments/checkout", { source: "storefront" }, "POST", {}).then((data: any) => {
      if (data?.link) {
        window.location.href = data.link
      }
    })
  }

  async function importLegacyStoreData() {
    if (!isAuthed) {
      setAuthPrompt(true)
      return
    }
    const legacyTheme = localStorage.getItem("store_theme") || ""
    await requestJSON("/api/settings", { theme: legacyTheme || "" }, "PUT", {})
    const legacyCart = safeParse<CartItem[]>("balnova_reseller_cart", [])
    if (legacyCart.length > 0) {
      await requestJSON("/api/cart", { items: toCartPayload(legacyCart) }, "PUT", {})
      window.dispatchEvent(new Event("cart:updated"))
    }
    await syncSettings()
    await syncCart()
  }

  async function saveSnapshot() {
    if (!isAuthed) {
      setAuthPrompt(true)
      return
    }
    if (cart.length === 0) return
    const name = await dialog.prompt("Snapshot name", { placeholder: "Snapshot name" })
    if (!name || !name.trim()) return
    await requestJSON(
      "/api/cart/snapshots",
      { name: name.trim(), items: toCartPayload(cart) },
      "POST",
      {}
    )
    await syncSnapshots()
  }

  async function loadSnapshot(snapshot: CartSnapshot) {
    if (!isAuthed) {
      setAuthPrompt(true)
      return
    }
    const items = snapshot.items.map((i) => ({
      productId: i.productId || null,
      name: i.name,
      price: i.price,
      qty: i.qty
    }))
    await requestJSON("/api/cart", { items }, "PUT", {})
    window.dispatchEvent(new Event("cart:updated"))
    await syncCart()
  }

  async function deleteSnapshot(id: string) {
    if (!isAuthed) {
      setAuthPrompt(true)
      return
    }
    await requestJSON(`/api/cart/snapshots/${id}`, {}, "DELETE", {})
    await syncSnapshots()
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100">
      <header className="bg-mynavy text-white shadow-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">{brand.name}</h1>
            <p className="text-[10px] text-gray-300">{brand.tagline}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {isAuthed ? (
              <LogoutButton className="inline-flex text-[10px] font-bold px-2 py-1 rounded-full border border-myamber/30 text-myamber hover:bg-myamber/10 transition-colors" />
            ) : (
              <Link
                href="/login"
                className="inline-flex text-[10px] font-bold px-2 py-1 rounded-full border border-myamber/30 text-myamber hover:bg-myamber/10 transition-colors"
              >
                Login
              </Link>
            )}
            <div className="relative">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 ? (
                <span className="absolute -top-1 -right-1 bg-myamber text-mynavy text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {authPrompt ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-center justify-between">
            <span>Sign in to add items to your cart or save snapshots.</span>
            <Link href="/login" className="font-bold text-amber-900 underline">
              Login
            </Link>
          </div>
        ) : null}
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products"
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
              {p.imageUrl ? (
                <div className="mb-3 h-32 w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700">
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ) : null}
              <div className="text-xs text-gray-400">{p.brand || "Bal Nova"}</div>
              <div className="font-bold">{p.name}</div>
              {p.desc ? <div className="text-[11px] text-gray-500 mt-1">{p.desc}</div> : null}
              <div className="text-sm text-myamber font-bold">{formatCurrency(p.price)}</div>
              <button
                onClick={() => addToCart(p)}
                className="mt-3 w-full text-xs font-bold bg-mynavy text-white py-2 rounded-lg hover:bg-myblue transition"
              >
                Add to Cart
              </button>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase">
            <Tag className="w-4 h-4" /> Cart Total
          </div>
          <div className="text-xl font-bold text-myamber mt-2">{formatCurrency(total)}</div>
          <div className="mt-4 space-y-3">
            {cart.length === 0 ? (
              <div className="text-xs text-gray-500">Your cart is empty.</div>
            ) : (
              cart.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-[10px] text-gray-400">{formatCurrency(c.price)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(c.id, -1)}
                      className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700 text-xs"
                    >
                      -
                    </button>
                    <span className="w-5 text-center text-xs font-bold">{c.qty}</span>
                    <button
                      onClick={() => updateQty(c.id, 1)}
                      className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700 text-xs"
                    >
                      +
                    </button>
                    <button onClick={() => removeItem(c.id)} className="text-[10px] text-red-400">
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <button
            onClick={checkout}
            className="mt-4 w-full text-xs font-bold bg-mynavy text-white py-2 rounded-lg hover:bg-myblue transition disabled:opacity-50"
            disabled={cart.length === 0}
          >
            Checkout
          </button>
          <button
            onClick={clearCart}
            className="mt-2 w-full text-[10px] font-bold bg-gray-100 text-gray-700 py-2 rounded-lg"
            disabled={cart.length === 0}
          >
            Clear Cart
          </button>
          <button
            onClick={saveSnapshot}
            className="mt-2 w-full text-[10px] font-bold bg-blue-50 text-blue-700 py-2 rounded-lg"
            disabled={cart.length === 0}
          >
            Save Cart Snapshot
          </button>
          <button
            onClick={importLegacyStoreData}
            className="mt-2 w-full text-[10px] font-bold bg-gray-100 text-gray-700 py-2 rounded-lg"
          >
            Import Legacy Local Data
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <div className="text-xs font-bold text-gray-500 uppercase mb-2">Saved Carts</div>
          {snapshots.length === 0 ? (
            <div className="text-xs text-gray-500">No saved carts yet.</div>
          ) : (
            <div className="space-y-2">
              {snapshots.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold">{s.name}</div>
                    <div className="text-[10px] text-gray-400">
                      {new Date(s.createdAt).toLocaleDateString()} · {s.items.length} items
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => loadSnapshot(s)} className="text-blue-600 font-bold">
                      Load
                    </button>
                    <button onClick={() => deleteSnapshot(s.id)} className="text-red-500 font-bold">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showSuccess ? (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center border-t-4 border-purple-600">
            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              <Tag className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold dark:text-white mb-2">Order Placed</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Your order has been queued for processing.
            </p>
            <button
              onClick={() => setShowSuccess(false)}
              className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700"
            >
              Okay
            </button>
          </div>
        </div>
      ) : null}
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


