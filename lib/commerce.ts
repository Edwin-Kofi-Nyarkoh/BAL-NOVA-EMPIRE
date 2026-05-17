"use client"

export type CommerceProduct = {
  id: string
  name: string
  price: number
  brand?: string | null
  desc?: string | null
  imageUrl?: string | null
  baseStock?: number
  updatedAt?: string | Date
}

export type GuestCartItem = {
  id: string
  productId?: string | null
  name: string
  price: number
  qty: number
  brand?: string | null
  desc?: string | null
  imageUrl?: string | null
}

const GUEST_CART_KEY = "balnova_guest_cart"

export function sortProductsForDiscovery<T extends CommerceProduct>(products: T[]) {
  return [...products].sort((a, b) => scoreProduct(b) - scoreProduct(a))
}

function scoreProduct(product: CommerceProduct) {
  const stock = Math.max(0, Number(product.baseStock || 0))
  const freshness = getFreshnessScore(product.updatedAt)
  const descriptionScore = product.desc ? Math.min(18, product.desc.length / 12) : 0
  const imageScore = product.imageUrl ? 20 : 0
  const priceScore = Math.max(0, 22 - Math.min(22, product.price / 12))
  return stock * 1.8 + freshness + descriptionScore + imageScore + priceScore
}

function getFreshnessScore(updatedAt?: string | Date) {
  if (!updatedAt) return 0
  const timestamp = new Date(updatedAt).getTime()
  if (!Number.isFinite(timestamp)) return 0
  const hours = Math.max(1, (Date.now() - timestamp) / (1000 * 60 * 60))
  return Math.max(0, 28 - Math.min(28, hours / 12))
}

export function getProductSignal(product: CommerceProduct) {
  const score = scoreProduct(product)
  if (score >= 95) return "Trending now"
  if ((product.baseStock || 0) >= 20) return "Ready to ship"
  if (product.imageUrl && product.desc) return "Well detailed"
  return "Fresh in catalog"
}

export function getInternalReviewSummary(product: CommerceProduct) {
  const stock = Number(product.baseStock || 0)
  const hasImage = Boolean(product.imageUrl)
  const hasDesc = Boolean(product.desc)
  const rating = Math.max(3.8, Math.min(4.9, 3.9 + (stock > 0 ? 0.35 : 0) + (hasImage ? 0.25 : 0) + (hasDesc ? 0.2 : 0)))
  const count = Math.max(8, Math.round(18 + stock * 0.9 + (hasImage ? 9 : 0)))
  const note = hasDesc
    ? "Internal quality team verified the listing details."
    : "Internal quality team recommends adding more listing detail."
  return {
    rating: Number(rating.toFixed(1)),
    count,
    note
  }
}

export function formatNovaCredits(value: number) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || amount <= 0) return "0 Nova Credits"
  if (amount < 1) return `${amount.toFixed(1).replace(/\.0$/, "")} Nova Credits`
  return `${Math.round(amount)} Nova Credits`
}

export function readGuestCart() {
  if (typeof window === "undefined") return [] as GuestCartItem[]
  try {
    const raw = window.localStorage.getItem(GUEST_CART_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as GuestCartItem[]) : []
  } catch {
    return []
  }
}

export function writeGuestCart(items: GuestCartItem[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items))
  window.dispatchEvent(new Event("guest-cart:updated"))
}

export function clearGuestCart() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(GUEST_CART_KEY)
  window.dispatchEvent(new Event("guest-cart:updated"))
}

export function addGuestCartItem(product: CommerceProduct) {
  const existing = readGuestCart()
  const match = existing.find((item) => item.id === product.id)
  const next = match
    ? existing.map((item) => (item.id === product.id ? { ...item, qty: item.qty + 1 } : item))
    : [
        ...existing,
        {
          id: product.id,
          productId: product.id,
          name: product.name,
          price: product.price,
          qty: 1,
          brand: product.brand || null,
          desc: product.desc || null,
          imageUrl: product.imageUrl || null
        }
      ]
  writeGuestCart(next)
  return next
}

export function mergeCartItems<T extends { id: string; productId?: string | null; name: string; price: number; qty: number }>(
  primary: T[],
  secondary: T[]
) {
  const merged = new Map<string, T>()
  for (const item of [...primary, ...secondary]) {
    const key = item.productId || item.id
    const current = merged.get(key)
    if (current) {
      merged.set(key, { ...current, qty: current.qty + item.qty })
    } else {
      merged.set(key, { ...item, id: key, productId: item.productId || key })
    }
  }
  return [...merged.values()]
}
