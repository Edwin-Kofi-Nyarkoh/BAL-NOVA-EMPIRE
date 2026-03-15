"use client"

import { useEffect, useState } from "react"
import { getJSON } from "@/lib/sync"

type CartItem = { qty: number }

export function useCartCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let active = true
    const fetchCart = async () => {
      const data = await getJSON<{ items?: CartItem[] }>("/api/cart", {})
      const items = Array.isArray(data.items) ? data.items : []
      const total = items.reduce((sum, item) => sum + (item.qty || 0), 0)
      if (active) setCount(total)
    }

    void fetchCart()

    const onUpdate = () => void fetchCart()
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchCart()
    }
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchCart()
    }, 15000)

    window.addEventListener("cart:updated", onUpdate as EventListener)
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener("cart:updated", onUpdate as EventListener)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  return count
}
