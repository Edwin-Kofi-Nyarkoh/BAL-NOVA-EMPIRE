// app/reseller-army/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { AdminShell } from "@/components/dashboard/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

type ResellerRow = {
  id: string
  userId: string
  name: string
  tagline: string
  tier: number
  teamCount: number
  createdAt: string
}

type OrderRow = {
  id: string
  price: number
  status: string
  origin?: string | null
  createdAt: string
}

export default function ResellerArmyPage() {
  const [resellers, setResellers] = useState<ResellerRow[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")

  useEffect(() => {
    let active = true
    async function load() {
      setStatus("loading")
      try {
        const [resellersRes, ordersRes] = await Promise.all([
          fetch("/api/admin/resellers"),
          fetch("/api/orders?all=1")
        ])
        const resellersJson = resellersRes.ok ? await resellersRes.json().catch(() => ({})) : {}
        const ordersJson = ordersRes.ok ? await ordersRes.json().catch(() => ({})) : {}
        if (!active) return
        setResellers(Array.isArray(resellersJson.resellers) ? resellersJson.resellers : [])
        setOrders(Array.isArray(ordersJson.orders) ? ordersJson.orders : [])
        setStatus("idle")
      } catch {
        if (!active) return
        setStatus("error")
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const storefrontOrders = useMemo(
    () => orders.filter((o) => (o.origin || "").toLowerCase() === "storefront"),
    [orders]
  )
  const storefrontRevenue = storefrontOrders.reduce((sum, o) => sum + o.price, 0)

  return (
    <AdminShell title="Reseller Army" subtitle="Reseller performance and growth">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-mydark">
          <CardContent className="p-6">
            <p className="text-xs text-gray-500 uppercase">Active Resellers</p>
            <p className="text-2xl font-bold text-mynavy dark:text-white">{resellers.length}</p>
            <p className="text-[10px] text-gray-400">Registered brands</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-mydark">
          <CardContent className="p-6">
            <p className="text-xs text-gray-500 uppercase">Storefront Orders</p>
            <p className="text-2xl font-bold text-blue-600">{storefrontOrders.length}</p>
            <p className="text-[10px] text-gray-400">Origin = storefront</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-mydark">
          <CardContent className="p-6">
            <p className="text-xs text-gray-500 uppercase">Storefront Revenue</p>
            <p className="text-2xl font-bold text-myamber">{formatCurrency(storefrontRevenue)}</p>
            <p className="text-[10px] text-gray-400">Gross receipts</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mt-6 relative overflow-hidden">
        <div className="scanning-line opacity-30" />
        <h3 className="font-bold text-lg dark:text-white mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 pulse-dot" />
          Reseller Army
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="p-4">Brand</th>
                <th className="p-4">Tagline</th>
                <th className="p-4">Team</th>
                <th className="p-4 text-right">Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 dark:text-gray-300">
              {status === "error" ? (
                <tr>
                  <td colSpan={4} className="p-4 text-sm text-red-500">
                    Unable to load resellers.
                  </td>
                </tr>
              ) : resellers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-sm text-gray-500">
                    No reseller brands yet.
                  </td>
                </tr>
              ) : (
                resellers.map((r) => (
                  <tr key={r.id}>
                    <td className="p-4 font-semibold">{r.name}</td>
                    <td className="p-4 text-xs text-gray-500">{r.tagline}</td>
                    <td className="p-4 text-xs text-gray-500">{r.teamCount}</td>
                    <td className="p-4 text-right font-bold text-mynavy dark:text-white">Tier {r.tier}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  )
}
