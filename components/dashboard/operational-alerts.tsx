"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

type AlertItem = {
  id: string
  tone: "warning" | "danger" | "info"
  title: string
  message: string
}

type AnalyticsResponse = {
  totals: {
    lowInventoryCount: number
  }
  last24h: {
    orders: number
  }
}

export function OperationalAlerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true
    async function load(attempt = 0) {
      try {
        const [healthRes, analyticsRes] = await Promise.all([
          fetch("/api/health"),
          fetch("/api/analytics")
        ])
        if (!active) return
        const healthJson = await healthRes.json().catch(() => ({}))
        const analyticsJson = analyticsRes.ok ? ((await analyticsRes.json()) as AnalyticsResponse) : null

        const next: AlertItem[] = []

        if (healthJson?.db !== "ok") {
          next.push({
            id: "db",
            tone: "danger",
            title: "Database Status",
            message: healthJson?.error || "Database connectivity is degraded."
          })
        }

        if (analyticsJson?.totals?.lowInventoryCount > 0) {
          next.push({
            id: "inventory",
            tone: "warning",
            title: "Low Inventory",
            message: `${analyticsJson.totals.lowInventoryCount} SKUs are below the safety threshold.`
          })
        }

        if ((analyticsJson?.last24h?.orders || 0) > 50) {
          next.push({
            id: "orders",
            tone: "info",
            title: "Order Spike",
            message: `Orders in last 24h: ${analyticsJson.last24h.orders}.`
          })
        }

        setAlerts(next)
      } catch {
        if (!active) return
        setAlerts([
          {
            id: "health",
            tone: "warning",
            title: "Telemetry Offline",
            message: attempt < 2 ? "Unable to load system alerts. Retrying shortly..." : "Unable to load system alerts."
          }
        ])
        if (attempt < 2) {
          const delay = attempt === 0 ? 4000 : 8000
          retryTimer.current = setTimeout(() => {
            void load(attempt + 1)
          }, delay)
        }
      }
    }

    load()
    const interval = setInterval(load, 60000)
    return () => {
      active = false
      if (retryTimer.current) clearTimeout(retryTimer.current)
      clearInterval(interval)
    }
  }, [])

  if (!alerts.length) return null

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={cn(
            "rounded-xl border px-4 py-3 text-sm flex items-start gap-3",
            alert.tone === "danger" && "border-red-200 bg-red-50 text-red-700",
            alert.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
            alert.tone === "info" && "border-blue-200 bg-blue-50 text-blue-700",
            "dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
          )}
        >
          <div>
            <p className="font-bold">{alert.title}</p>
            <p className="text-xs opacity-80">{alert.message}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
