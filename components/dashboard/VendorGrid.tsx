// components/dashboard/VendorGrid.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatCurrency } from "@/lib/utils"

type InventoryItem = {
  id: string
  name: string
  price: number
  brand?: string | null
  baseStock?: number | null
}

type VendorRow = {
  name: string
  type: string
  revenue: string
  initial: string
  meta?: string
}

export function VendorGrid() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [adminVendors, setAdminVendors] = useState<VendorRow[]>([])

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [vendorsRes, inventoryRes] = await Promise.all([
          fetch("/api/admin/vendors"),
          fetch("/api/inventory")
        ])
        const vendorsJson = vendorsRes.ok ? await vendorsRes.json().catch(() => ({})) : {}
        const inventoryJson = inventoryRes.ok ? await inventoryRes.json().catch(() => ({})) : {}
        if (!active) return
        const adminList = Array.isArray(vendorsJson.vendors) ? vendorsJson.vendors : []
        if (adminList.length) {
          setAdminVendors(
            adminList.map((v: any) => ({
              name: v.name,
              type: `Tier ${v.tier}`,
              revenue: "—",
              initial: v.initials,
              meta: `${v.hubCount} hubs · ${v.staffCount} staff`
            }))
          )
        }
        setItems(Array.isArray(inventoryJson.items) ? inventoryJson.items : [])
      } catch {
        if (!active) return
        setItems([])
        setAdminVendors([])
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const vendors = useMemo<VendorRow[]>(() => {
    const map = new Map<string, { total: number }>()
    for (const item of items) {
      const brand = item.brand?.trim() || "Unknown"
      const total = (item.price || 0) * (item.baseStock || 0)
      const entry = map.get(brand) || { total: 0 }
      entry.total += total
      map.set(brand, entry)
    }

    if (adminVendors.length) {
      return adminVendors.map((v) => ({
        ...v,
        revenue: formatCurrency(map.get(v.name)?.total || 0)
      }))
    }

    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      type: "Brand",
      revenue: formatCurrency(data.total),
      initial: name
        .split(" ")
        .map((s) => s[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    }))
  }, [items, adminVendors])

  if (!vendors.length) {
    return <div className="text-sm text-gray-500">No vendors yet.</div>
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 relative overflow-hidden">
      <div className="scanning-line opacity-30" />
      <h3 className="font-bold text-lg dark:text-white mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500 pulse-dot" />
        Vendor Network
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="p-4">Vendor</th>
              <th className="p-4">Tier</th>
              <th className="p-4">Meta</th>
              <th className="p-4 text-right">Inventory Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700 dark:text-gray-300">
            {vendors.map((vendor) => (
              <tr key={vendor.name}>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 bg-mynavy text-myamber border border-myamber">
                      <AvatarFallback>{vendor.initial}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold">{vendor.name}</div>
                      <div className="text-[10px] text-gray-400">{vendor.type}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-xs text-gray-500">{vendor.type}</td>
                <td className="p-4 text-xs text-gray-500">{vendor.meta || "—"}</td>
                <td className="p-4 text-right font-bold text-myamber">{vendor.revenue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {vendors.length === 0 ? <div className="text-sm text-gray-500 mt-4">No vendors yet.</div> : null}
    </div>
  )
}
