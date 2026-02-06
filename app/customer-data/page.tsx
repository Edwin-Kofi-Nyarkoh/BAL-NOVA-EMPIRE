// app/customer-data/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { AdminShell } from "@/components/dashboard/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

type UserRow = {
  id: string
  name: string | null
  email: string
  role: string
  createdAt: string
}

type OrderRow = {
  id: string
  userId?: string | null
  item: string
  price: number
  status: string
  createdAt: string
}

export default function CustomerDataPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      setStatus("loading")
      try {
        const [usersRes, ordersRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/orders?all=1")
        ])
        const usersJson = usersRes.ok ? await usersRes.json().catch(() => ({})) : {}
        const ordersJson = ordersRes.ok ? await ordersRes.json().catch(() => ({})) : {}
        if (!active) return
        setUsers(Array.isArray(usersJson.users) ? usersJson.users : [])
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

  useEffect(() => {
    setNow(Date.now())
  }, [])

  const totalUsers = users.length
  const totalOrders = orders.length
  const totalRevenue = orders.reduce((sum, o) => sum + o.price, 0)

  const newUsers7d = useMemo(() => {
    if (!now) return 0
    const cutoff = now - 7 * 24 * 60 * 60 * 1000
    return users.filter((u) => new Date(u.createdAt).getTime() >= cutoff).length
  }, [users, now])

  const topCustomers = useMemo(() => {
    const counts = new Map<string, { count: number; spend: number }>()
    orders.forEach((o) => {
      if (!o.userId) return
      const entry = counts.get(o.userId) || { count: 0, spend: 0 }
      entry.count += 1
      entry.spend += o.price
      counts.set(o.userId, entry)
    })
    const userMap = new Map(users.map((u) => [u.id, u]))
    return Array.from(counts.entries())
      .map(([userId, stats]) => ({
        userId,
        name: userMap.get(userId)?.name || userMap.get(userId)?.email || "Unknown",
        count: stats.count,
        spend: stats.spend
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 6)
  }, [orders, users])

  const recentUsers = useMemo(() => users.slice(0, 6), [users])
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.name || u.email])), [users])
  const recentOrders = useMemo(() => orders.slice(0, 10), [orders])

  return (
    <AdminShell title="Customer Data" subtitle="Profiles, segments, and retention signals">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-mydark">
          <CardContent className="p-6">
            <p className="text-xs text-gray-500 uppercase">Total Customers</p>
            <p className="text-2xl font-bold text-mynavy dark:text-white">{totalUsers}</p>
            <p className="text-[10px] text-gray-400">All registered users</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-mydark">
          <CardContent className="p-6">
            <p className="text-xs text-gray-500 uppercase">New (7 days)</p>
            <p className="text-2xl font-bold text-green-600">{newUsers7d}</p>
            <p className="text-[10px] text-gray-400">Recent signups</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-mydark">
          <CardContent className="p-6">
            <p className="text-xs text-gray-500 uppercase">Lifetime Revenue</p>
            <p className="text-2xl font-bold text-myamber">{formatCurrency(totalRevenue)}</p>
            <p className="text-[10px] text-gray-400">{totalOrders} orders</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="bg-white dark:bg-mydark">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-500 uppercase">Top Customers</h3>
              <span className="text-[10px] text-gray-400">by spend</span>
            </div>
            {topCustomers.length === 0 ? (
              <p className="text-sm text-gray-500">No customer orders yet.</p>
            ) : (
              topCustomers.map((c) => (
                <div key={c.userId} className="flex items-center justify-between text-sm border-b border-gray-200/60 dark:border-white/10 pb-2">
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-right">
                    <div className="font-bold text-mynavy dark:text-white">{formatCurrency(c.spend)}</div>
                    <div className="text-[10px] text-gray-400">{c.count} orders</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-mydark">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-500 uppercase">Recent Signups</h3>
              <span className="text-[10px] text-gray-400">{recentUsers.length} shown</span>
            </div>
            {status === "error" ? (
              <p className="text-sm text-red-500">Unable to load customer data.</p>
            ) : recentUsers.length === 0 ? (
              <p className="text-sm text-gray-500">No customers yet.</p>
            ) : (
              recentUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between text-sm border-b border-gray-200/60 dark:border-white/10 pb-2">
                  <div>
                    <div className="font-semibold">{u.name || u.email}</div>
                    <div className="text-[10px] text-gray-400">{u.email}</div>
                  </div>
                  <span className="text-[10px] text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mt-6 relative overflow-hidden">
        <div className="scanning-line opacity-30" />
        <h3 className="font-bold text-lg dark:text-white mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 pulse-dot" />
          Customer Orders (Real-Time)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="p-4">Order ID</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Item</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 dark:text-gray-300">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-sm text-gray-500">
                    No orders yet.
                  </td>
                </tr>
              ) : (
                recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="p-4 text-xs text-gray-500">{o.id}</td>
                    <td className="p-4">{userMap.get(o.userId || "") || "Unknown"}</td>
                    <td className="p-4">{o.item}</td>
                    <td className="p-4 font-bold text-myamber">{formatCurrency(o.price)}</td>
                    <td className="p-4 text-xs">
                      <span
                        className={`inline-flex text-[10px] font-bold px-2 py-1 rounded-full ${
                          o.status === "Paid" || o.status === "Delivered"
                            ? "bg-emerald-500/15 text-emerald-600"
                            : "bg-amber-500/15 text-amber-600"
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
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
