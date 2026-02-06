// app/customer/layout.tsx
"use client"

import { BottomNav } from "@/components/customer/BottomNav"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ShoppingCart } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { getJSON, requestJSON } from "@/lib/sync"
import { useCartCount } from "@/components/cart/use-cart-count"

type CartItem = {
  id: string
  productId?: string | null
  name: string
  price: number
  qty: number
}

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLegacyCustomer = pathname === "/customer"
  const cartCount = useCartCount()
  const [showCartDrawer, setShowCartDrawer] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])

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
        name: i.name,
        price: i.price,
        qty: i.qty
      }))
    )
  }

  useEffect(() => {
    if (showCartDrawer) {
      void syncCart()
    }
  }, [showCartDrawer])

  const cartTotal = useMemo(() => cart.reduce((sum, c) => sum + c.price * c.qty, 0), [cart])

  function toCartPayload(items: CartItem[]) {
    return items.map((i) => ({
      productId: i.productId || i.id,
      name: i.name,
      price: i.price,
      qty: i.qty
    }))
  }

  function updateCartQty(productId: string, delta: number) {
    const next = cart
      .map((p) => (p.id === productId ? { ...p, qty: Math.max(1, p.qty + delta) } : p))
      .filter((p) => p.qty > 0)
    setCart(next)
    void requestJSON("/api/cart", { items: toCartPayload(next) }, "PUT", {}).then(() => {
      window.dispatchEvent(new Event("cart:updated"))
    })
  }

  function removeFromCart(productId: string) {
    const next = cart.filter((p) => p.id !== productId)
    setCart(next)
    void requestJSON("/api/cart", { items: toCartPayload(next) }, "PUT", {}).then(() => {
      window.dispatchEvent(new Event("cart:updated"))
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-mydark">
      <main className={isLegacyCustomer ? "flex-1 p-0" : "flex-1 pb-24 p-4 max-w-md mx-auto w-full"}>
        {children}
      </main>

      {isLegacyCustomer ? null : <BottomNav />}

      {!isLegacyCustomer ? (
        <>
          <button
            onClick={() => setShowCartDrawer(true)}
            className="fixed bottom-24 right-4 z-40 w-12 h-12 rounded-full bg-mynavy text-white shadow-lg flex items-center justify-center"
            aria-label="Open cart drawer"
          >
            <span className="relative">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 ? (
                <span className="absolute -top-2 -right-2 bg-myamber text-mynavy text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              ) : null}
            </span>
          </button>

          {showCartDrawer ? (
            <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex justify-end">
              <div className="w-full max-w-sm h-full bg-white dark:bg-gray-900 p-6 shadow-2xl flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg dark:text-white">Cart Drawer</h3>
                  <button onClick={() => setShowCartDrawer(false)} className="text-gray-400 text-xl">
                    x
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3">
                  {cart.length === 0 ? (
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
                            onClick={() => updateCartQty(c.id, -1)}
                            className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700 text-xs"
                          >
                            -
                          </button>
                          <span className="w-5 text-center text-xs font-bold">{c.qty}</span>
                          <button
                            onClick={() => updateCartQty(c.id, 1)}
                            className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700 text-xs"
                          >
                            +
                          </button>
                          <button onClick={() => removeFromCart(c.id)} className="text-[10px] text-red-400">
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="border-t dark:border-gray-700 pt-4">
                  <div className="flex justify-between items-center mb-3 text-sm">
                    <span>Total</span>
                    <span className="font-bold text-myamber">{formatCurrency(cartTotal)}</span>
                  </div>
                  <button
                    onClick={() => {
                      setShowCartDrawer(false)
                      window.location.href = "/customer/cart"
                    }}
                    className="w-full bg-mynavy text-white py-3 rounded-xl font-bold"
                  >
                    Go to Cart
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

