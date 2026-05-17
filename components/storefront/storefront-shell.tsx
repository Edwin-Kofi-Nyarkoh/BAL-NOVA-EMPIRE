"use client"

import { useEffect, useMemo, useState } from "react"
import { ShoppingCart, Search, Sun, Moon, Tag } from "lucide-react"
import { cn } from "@/lib/utils"
import { getJSON, requestJSON } from "@/lib/sync"
import { LogoutButton } from "@/components/logout-button"
import { useDialog } from "@/components/ui/dialog-service"
import Link from "next/link"
import {
  addGuestCartItem,
  clearGuestCart,
  formatNovaCredits,
  getInternalReviewSummary,
  getProductSignal,
  mergeCartItems,
  readGuestCart,
  sortProductsForDiscovery,
  writeGuestCart
} from "@/lib/commerce"
import { useSearchParams } from "next/navigation"

type Product = {
  id: string
  name: string
  price: number
  desc?: string
  brand?: string
  imageUrl?: string
  vendor?: {
    id: string
    name: string
    initials: string
    tier: number
    region?: string | null
    hubName?: string | null
  } | null
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

type StorefrontShellProps = {
  forcedVendorId?: string
  vendorPageHrefBase?: string
  hideHero?: boolean
  initialProducts?: Product[]
}

function mapGuestItems(items: ReturnType<typeof readGuestCart>): CartItem[] {
  return items.map((item) => ({
    id: item.productId || item.id,
    productId: item.productId || item.id,
    cartItemId: item.productId || item.id,
    name: item.name,
    price: item.price,
    qty: item.qty,
    brand: item.brand || undefined,
    desc: item.desc || undefined,
    imageUrl: item.imageUrl || undefined,
    vendor: null
  }))
}

export function StorefrontShell({ forcedVendorId, vendorPageHrefBase = "/vendors", hideHero = false, initialProducts = [] }: StorefrontShellProps) {
  const dialog = useDialog()
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [cart, setCart] = useState<CartItem[]>([])
  const [snapshots, setSnapshots] = useState<CartSnapshot[]>([])
  const [brand, setBrand] = useState<StoreBrand>({ name: "Bal Nova", tagline: "Global marketplace and service network" })
  const [isDark, setIsDark] = useState(false)
  const [query, setQuery] = useState("")
  const [showSuccess, setShowSuccess] = useState(false)
  const [isAuthed, setIsAuthed] = useState(false)
  const [authPrompt, setAuthPrompt] = useState(false)
  const vendorIdFilter = forcedVendorId || searchParams.get("vendorId") || ""

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
        await syncCart(true)
        void syncSnapshots()
      } else {
        setIsAuthed(false)
        setBrand({ name: "Bal Nova", tagline: "Global marketplace and service network" })
        setCart(mapGuestItems(readGuestCart()))
      }
    } catch {
      setIsAuthed(false)
      setBrand({ name: "Bal Nova", tagline: "Global marketplace and service network" })
      setCart(mapGuestItems(readGuestCart()))
    }
  }

  async function syncInventory() {
    const data = await getJSON<{ items: Product[] }>("/api/inventory", { items: [] })
    if (Array.isArray(data.items) && data.items.length > 0) {
      setProducts(data.items)
    }
  }

  async function syncBrand() {
    const data = await getJSON<{ brand?: { name: string; tagline: string } | null }>("/api/reseller/brand", {})
    if (data.brand) {
      setBrand({ name: data.brand.name, tagline: data.brand.tagline })
      return
    }
    const me = await getJSON<{ user?: { name?: string | null; email?: string | null } }>("/api/me", {})
    const name = me.user?.name || me.user?.email || "Bal Nova"
    setBrand({ name, tagline: "Global marketplace and service network" })
  }

  async function syncSettings() {
    const data = await getJSON<{ settings?: { theme?: string } }>("/api/settings", {})
    const dark = data.settings?.theme === "dark"
    setIsDark(dark)
    document.documentElement.classList.toggle("dark", dark)
  }

  async function syncCart(mergeGuest = false) {
    const data = await getJSON<{ items?: { id: string; productId?: string | null; name: string; price: number; qty: number }[] }>(
      "/api/cart",
      {}
    )
    const items = Array.isArray(data.items) ? data.items : []
    const mapped = items.map((i) => ({
      id: i.productId || i.id,
      productId: i.productId || null,
      cartItemId: i.id,
      name: i.name,
      price: i.price,
      qty: i.qty
    }))
    if (mergeGuest) {
      const guestItems = readGuestCart()
      if (guestItems.length > 0) {
        const merged = mergeCartItems(
          mapped.map((item) => ({ ...item, productId: item.productId || null, cartItemId: item.cartItemId || item.id })),
          mapGuestItems(guestItems).map((item) => ({
            ...item,
            productId: item.productId || null,
            cartItemId: item.cartItemId || item.id
          }))
        )
        setCart(merged)
        await requestJSON("/api/cart", { items: toCartPayload(merged) }, "PUT", {})
        clearGuestCart()
        window.dispatchEvent(new Event("cart:updated"))
        return
      }
    }
    setCart(mapped)
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
    const vendorScoped = vendorIdFilter ? products.filter((p) => p.vendor?.id === vendorIdFilter) : products
    const ranked = sortProductsForDiscovery(vendorScoped)
    if (!query.trim()) return ranked
    const q = query.toLowerCase()
    return ranked.filter((p) => p.name.toLowerCase().includes(q) || (p.brand || "").toLowerCase().includes(q))
  }, [products, query, vendorIdFilter])

  const activeVendor = useMemo(() => {
    if (!vendorIdFilter) return null
    return products.find((p) => p.vendor?.id === vendorIdFilter)?.vendor || null
  }, [products, vendorIdFilter])

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
      const next = addGuestCartItem(product)
      setCart(mapGuestItems(next))
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
      const next = cart
        .map((p) => (p.id === id ? { ...p, qty: Math.max(1, p.qty + delta) } : p))
        .filter((p) => p.qty > 0)
      setCart(next)
      writeGuestCart(next)
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
      const next = cart.filter((p) => p.id !== id)
      setCart(next)
      writeGuestCart(next)
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
      clearGuestCart()
      setCart([])
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
      window.location.href = "/login?returnTo=/&checkout=1"
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
    const legacyCart = readGuestCart()
    if (legacyCart.length > 0) {
      await requestJSON("/api/cart", { items: toCartPayload(mapGuestItems(legacyCart)) }, "PUT", {})
      clearGuestCart()
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
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
              <img src="/empire-shield.svg" alt="Bal Nova" className="h-8 w-8" />
            </span>
            <span>
              <h1 className="font-bold text-lg leading-none">{brand.name}</h1>
              <p className="mt-1 text-[10px] text-gray-300">{brand.tagline}</p>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/business"
              className="inline-flex text-[10px] font-bold px-2 py-1 rounded-full border border-white/20 text-white hover:bg-white/10"
            >
              For Business
            </Link>
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

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {authPrompt ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-center justify-between">
            <span>Guests can build a cart here. Login is only required when you move to checkout or snapshots.</span>
            <Link href="/login" className="font-bold text-amber-900 underline">
              Login
            </Link>
          </div>
        ) : null}

        {hideHero ? null : (
          <div className="rounded-2xl border border-gray-100 bg-gradient-to-r from-[#07142f] via-[#0a2147] to-[#132b57] p-6 text-white dark:border-gray-800">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Storefront</p>
            <h1 className="mt-3 text-3xl font-black md:text-4xl">
              {activeVendor ? `${activeVendor.name}'s storefront` : "Bal Nova"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-200">
              {activeVendor
                ? `Browse products from ${activeVendor.name}, review vendor details, and add to cart before logging in at checkout.`
                : "Browse products immediately, add items as a guest, and only log in when you are ready to check out."}
            </p>
            {activeVendor ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                <span className="rounded-full bg-white/10 px-3 py-1 font-bold text-amber-200">Vendor tier {activeVendor.tier}</span>
                {activeVendor.region ? <span className="rounded-full bg-white/10 px-3 py-1">Region: {activeVendor.region}</span> : null}
                {activeVendor.hubName ? <span className="rounded-full bg-white/10 px-3 py-1">Hub: {activeVendor.hubName}</span> : null}
                <Link href="/" className="rounded-full bg-amber-300 px-3 py-1 font-bold text-mynavy">
                  View All Products
                </Link>
              </div>
            ) : null}
          </div>
        )}

        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products"
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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
                {p.vendor ? (
                  <Link
                    href={`${vendorPageHrefBase}/${encodeURIComponent(p.vendor.id)}`}
                    className="mt-3 block rounded-lg border border-amber-100 bg-amber-50/70 p-3 text-[11px] text-amber-950 transition hover:border-amber-300 hover:bg-amber-100/80 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100 dark:hover:bg-amber-950/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-200 text-[10px] font-black text-amber-900 dark:bg-amber-800 dark:text-amber-50">
                        {p.vendor.initials}
                      </span>
                      <div>
                        <div className="font-bold">Sold by {p.vendor.name}</div>
                        <div className="text-[10px] opacity-80">Vendor tier {p.vendor.tier} - View storefront</div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                      {p.vendor.region ? <span className="rounded-full bg-white/70 px-2 py-1 dark:bg-white/10">Region: {p.vendor.region}</span> : null}
                      {p.vendor.hubName ? <span className="rounded-full bg-white/70 px-2 py-1 dark:bg-white/10">Hub: {p.vendor.hubName}</span> : null}
                    </div>
                  </Link>
                ) : (
                  <div className="mt-3 text-[10px] text-gray-400">Fulfilled by Bal Nova network</div>
                )}
                <div className="mt-1 text-[11px] text-gray-400">{getProductSignal(p)}</div>
                <div className="text-sm text-myamber font-bold">{formatNovaCredits(p.price)}</div>
                <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-2 text-[11px] text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
                  {(() => {
                    const review = getInternalReviewSummary(p)
                    return `${review.rating}/5 internal rating · ${review.count} reviews`
                  })()}
                </div>
                <button
                  onClick={() => addToCart(p)}
                  className="mt-3 w-full text-xs font-bold bg-mynavy text-white py-2 rounded-lg hover:bg-myblue transition"
                >
                  Add to Cart
                </button>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 h-fit lg:sticky lg:top-24">
            <div className="flex items-center gap-2 text-xs text-gray-400 uppercase">
              <Tag className="w-4 h-4" /> Cart Total
            </div>
            <div className="text-xl font-bold text-myamber mt-2">{formatNovaCredits(total)}</div>
            <div className="mt-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-xs text-gray-500">Your cart is empty.</div>
              ) : (
                cart.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{c.name}</div>
                      <div className="text-[10px] text-gray-400">{formatNovaCredits(c.price)}</div>
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

            <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-700">
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
          </div>
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
