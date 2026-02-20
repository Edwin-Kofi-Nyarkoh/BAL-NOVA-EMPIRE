"use client"

import { useEffect, useMemo, useState } from "react"
import { Minus, Plus, Trash2 } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { getJSON, requestJSON } from "@/lib/sync"
import { useDialog } from "@/components/ui/dialog-service"

type CartItem = {
  id: string
  productId?: string | null
  name: string
  price: number
  qty: number
}

type Order = {
  id: string
  item: string
  status: string
  price: number
  createdAt: string
}

type CartSnapshot = {
  id: string
  name: string
  createdAt: string
  items: { id: string; productId?: string | null; name: string; price: number; qty: number }[]
}

export default function CustomerCartPage() {
  const dialog = useDialog()
  const [cart, setCart] = useState<CartItem[]>([])
  const [snapshots, setSnapshots] = useState<CartSnapshot[]>([])
  const [deliveryMode, setDeliveryMode] = useState<"delivery" | "pickup">("delivery")
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [loading, setLoading] = useState(true)

  async function syncCart() {
    setLoading(true)
    const data = await getJSON<{ items?: { id: string; productId?: string | null; name: string; price: number; qty: number }[] }>(
      "/api/cart",
      {}
    )
    const items = Array.isArray(data.items) ? data.items : []
    setCart(
      items.map((i) => ({
        id: i.productId || i.id,
        productId: i.productId || null,
        name: i.name,
        price: i.price,
        qty: i.qty
      }))
    )
    setLoading(false)
  }

  async function syncSnapshots() {
    const data = await getJSON<{ snapshots?: CartSnapshot[] }>("/api/cart/snapshots", {})
    setSnapshots(Array.isArray(data.snapshots) ? data.snapshots : [])
  }

  const cartTotal = useMemo(() => cart.reduce((sum, c) => sum + c.price * c.qty, 0), [cart])

  useEffect(() => {
    void syncCart()
    void syncSnapshots()
  }, [])

  useEffect(() => {
    const base = deliveryMode === "pickup" ? 0 : 10
    const variable = deliveryMode === "pickup" ? 0 : Math.min(25, cartTotal * 0.03)
    setDeliveryFee(Number((base + variable).toFixed(2)))
  }, [cartTotal, deliveryMode])

  function toCartPayload(items: CartItem[]) {
    return items.map((i) => ({
      productId: i.productId || i.id,
      name: i.name,
      price: i.price,
      qty: i.qty
    }))
  }

  function updateCart(next: CartItem[]) {
    setCart(next)
    void requestJSON("/api/cart", { items: toCartPayload(next) }, "PUT", {}).then(() => {
      window.dispatchEvent(new Event("cart:updated"))
    })
  }

  function increment(id: string) {
    updateCart(cart.map((c) => (c.id === id ? { ...c, qty: c.qty + 1 } : c)))
  }

  function decrement(id: string) {
    updateCart(
      cart
        .map((c) => (c.id === id ? { ...c, qty: Math.max(1, c.qty - 1) } : c))
        .filter((c) => c.qty > 0)
    )
  }

  function removeItem(id: string) {
    updateCart(cart.filter((c) => c.id !== id))
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

  async function saveSnapshot() {
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
    await requestJSON(`/api/cart/snapshots/${id}`, {}, "DELETE", {})
    await syncSnapshots()
  }

  return (
    <div className="max-w-lg mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manage Cart</h1>
        <p className="text-xs text-gray-500">Adjust quantities and review totals before checkout.</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
        {loading ? (
          <div className="text-sm text-gray-500">Loading cart...</div>
        ) : cart.length === 0 ? (
          <div className="text-sm text-gray-500">Your cart is empty.</div>
        ) : (
          cart.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold truncate">{c.name}</div>
                <div className="text-xs text-gray-400">{formatCurrency(c.price)}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => decrement(c.id)}
                  className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-900"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-6 text-center text-sm font-bold">{c.qty}</span>
                <button
                  onClick={() => increment(c.id)}
                  className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-900"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeItem(c.id)}
                  className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
        <div className="flex gap-2 p-1 bg-gray-200 dark:bg-gray-700 rounded-lg">
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

        <div className="border-t dark:border-gray-700 pt-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-500 text-sm">Delivery Fee</span>
            <span className="font-bold text-sm dark:text-white">{formatCurrency(deliveryFee)}</span>
          </div>
          <div className="flex justify-between items-center mb-6">
            <span className="font-bold text-xl dark:text-white">Total</span>
            <span className="font-bold text-xl text-myamber">{formatCurrency(cartTotal + deliveryFee)}</span>
          </div>
          <button
            onClick={checkout}
            disabled={cart.length === 0}
            className="w-full bg-mynavy text-white py-3 rounded-xl font-bold text-lg shadow-lg hover:bg-myblue transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Checkout
          </button>
          <button
            onClick={saveSnapshot}
            className="w-full mt-2 bg-blue-50 text-blue-700 py-2 rounded-xl text-xs font-bold"
            disabled={cart.length === 0}
          >
            Save Cart Snapshot
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
        <div className="text-xs font-bold text-gray-500 uppercase">Saved Carts</div>
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
  )
}
