// components/dashboard/sidebar.tsx
"use client"

import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import {
  LayoutDashboard,
  Store,
  Users,
  Bike,
  ShieldCheck,
  Settings,
  TrendingUp,
  History,
  Activity,
  BookOpen,
  Package,
  CreditCard,
  MessageCircle
} from "lucide-react"
import { ModeToggle } from "@/components/ui/mode-toggle"
import { useDialog } from "@/components/ui/dialog-service"
import { useToast } from "@/components/ui/toast-service"

const menuItems = [
  { icon: <LayoutDashboard size={20} />, label: "Empire HQ", href: "/admin-portal" },
  { icon: <TrendingUp size={20} />, label: "Financial Engine", href: "/financial-engine" },
  { icon: <Users size={20} />, label: "Executive Suite", href: "/executive-suite" },
  { icon: <LayoutDashboard size={20} />, label: "Financial Cockpit", href: "/financial-cockpit" },
  { icon: <Bike size={20} />, label: "Dispatch Tower", href: "/dispatch-tower" },
  { icon: <History size={20} />, label: "Fleet Command", href: "/fleet-command" },
  { icon: <ShieldCheck size={20} />, label: "QC Firewall", href: "/qc-firewall" },
  { icon: <Activity size={20} />, label: "Financial Stats", href: "/financial-stats" },
  { icon: <BookOpen size={20} />, label: "Finance Ledger", href: "/finance-ledger" },
  { icon: <Package size={20} />, label: "Inventory", href: "/inventory" },
  { icon: <CreditCard size={20} />, label: "Payments", href: "/payments" },
  { icon: <MessageCircle size={20} />, label: "Admin Messages", href: "/admin-messages" },
]

const ecosystemItems = [
  { icon: <Users size={20} />, label: "Customer Data", href: "/customer-data" },
  { icon: <Store size={20} />, label: "Vendor Network", href: "/vendor-network" },
  { icon: <Users size={20} />, label: "Reseller Army", href: "/reseller-army" },
  { icon: <Bike size={20} />, label: "Service Network", href: "/service-network" },
]

export function Sidebar({ className, isOpen, onClose }: { className?: string; isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)
  const [geoSummary, setGeoSummary] = useState<{ countries: any[]; regions: any[]; branches: any[] }>({
    countries: [],
    regions: [],
    branches: []
  })
  const { data: session } = useSession()
  const role = (session?.user as any)?.role || "user"
  const dialog = useDialog()
  const toast = useToast()

  useEffect(() => {
    if (role !== "admin") return
    let active = true
    async function loadPending() {
      try {
        const res = await fetch("/api/users")
        if (!res.ok) return
        const data = await res.json().catch(() => ({}))
        const users = Array.isArray(data?.users) ? data.users : []
        const pending = users.filter((u: any) => (u.approvalStatus || "approved") === "pending").length
        if (active) setPendingCount(pending)
      } catch {
        // ignore
      }
    }
    loadPending()
    const interval = setInterval(loadPending, 30000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [role])

  useEffect(() => {
    if (role !== "admin") return
    let active = true
    async function loadGeo() {
      try {
        const res = await fetch("/api/geo/summary")
        if (!res.ok) return
        const data = await res.json().catch(() => ({}))
        if (!active) return
        setGeoSummary({
          countries: Array.isArray(data.countries) ? data.countries : [],
          regions: Array.isArray(data.regions) ? data.regions : [],
          branches: Array.isArray(data.branches) ? data.branches : []
        })
      } catch {
        // ignore
      }
    }
    loadGeo()
    const interval = setInterval(loadGeo, 30000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [role])

  async function addCountry() {
    const name = await dialog.prompt("Country name", { placeholder: "e.g., Nigeria" })
    if (!name) return
    const code = await dialog.prompt("Country code (2 letters)", { placeholder: "NG" })
    if (!code) return
    const flag = await dialog.prompt("Flag emoji (optional)", { placeholder: "🇳🇬" })
    const currency = await dialog.prompt("Currency symbol (optional)", { placeholder: "₦" })
    const res = await fetch("/api/geo/countries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code, flag: flag || null, currency: currency || null })
    })
    if (!res.ok) {
      toast.push("Failed to add country.", "error")
      return
    }
    toast.push("Country added.")
    const data = await res.json().catch(() => ({}))
    setGeoSummary((prev) => ({ ...prev, countries: [data.country, ...prev.countries].slice(0, 5) }))
  }

  async function addRegion() {
    const countryCode = await dialog.prompt("Parent country code", { placeholder: "GH" })
    if (!countryCode) return
    const name = await dialog.prompt("Region name", { placeholder: "e.g., Lagos State" })
    if (!name) return
    const code = await dialog.prompt("Region code (3 letters)", { placeholder: "LAG" })
    if (!code) return
    const res = await fetch("/api/geo/regions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryCode, name, code })
    })
    if (!res.ok) {
      toast.push("Failed to add region.", "error")
      return
    }
    toast.push("Region added.")
    const data = await res.json().catch(() => ({}))
    setGeoSummary((prev) => ({ ...prev, regions: [data.region, ...prev.regions].slice(0, 5) }))
  }

  async function addBranch() {
    if (!geoSummary.regions.length) {
      toast.push("No region added yet. Add a region first.", "warning")
      return
    }
    const regionId = await dialog.prompt("Region ID", { placeholder: "Paste region id" })
    if (!regionId) return
    const name = await dialog.prompt("Branch name", { placeholder: "e.g., Accra Central Hub" })
    if (!name) return
    const res = await fetch("/api/geo/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regionId, name })
    })
    if (!res.ok) {
      toast.push("Failed to add branch.", "error")
      return
    }
    toast.push("Branch added.")
    const data = await res.json().catch(() => ({}))
    setGeoSummary((prev) => ({ ...prev, branches: [data.branch, ...prev.branches].slice(0, 5) }))
  }

  const visiblePendingCount = role === "admin" ? pendingCount : 0

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 w-64 bg-mynavy text-white flex flex-col transition-transform duration-300 shadow-xl border-r border-white/10",
      isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      className
    )}>
      <div className="p-6 flex flex-col items-center border-b border-white/10 relative">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-3 border-2 border-myamber relative">
          <ShieldCheck className="text-myamber w-8 h-8" />
          <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-mynavy pulse-dot" />
        </div>
        <h1 className="font-bold text-xl tracking-wide">EMPIRE HQ</h1>
        <p className="text-xs text-myamber/80">Global Command</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {menuItems.map((item, idx) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={idx}
              href={item.href}
              onClick={onClose}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left font-medium",
                isActive
                  ? "bg-myamber/10 text-myamber border-l-4 border-myamber"
                  : "text-gray-300 hover:bg-white/5 hover:text-white"
              )}
            >
              <span className="w-6 text-center">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}

        <div className="pt-2 mt-2 border-t border-white/10">
          <p className="px-4 text-[10px] text-gray-500 uppercase font-bold mb-1">Ecosystem</p>
          {ecosystemItems.map((item, idx) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={idx}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left font-medium",
                  isActive
                    ? "bg-white/10 text-white border-l-4 border-myamber"
                    : "text-gray-300 hover:bg-white/10 hover:text-white"
                )}
              >
                <span className="w-6 text-center">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </div>

        <div className="pt-4 mt-4 border-t border-white/10 space-y-2">
          <Link
            href="/system-config"
            onClick={onClose}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 text-myamber font-bold transition-colors text-left border border-myamber/30"
          >
            <Settings size={20} className="w-6 text-center" /> API & Settings
            {visiblePendingCount > 0 ? (
              <span className="ml-auto rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                {visiblePendingCount} pending
              </span>
            ) : null}
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={addBranch}
              className="bg-white/5 hover:bg-white/10 text-gray-400 text-xs py-2 rounded border border-dashed border-gray-600 hover:border-gray-400 transition-all flex flex-col items-center justify-center gap-1"
            >
              + Branch
            </button>
            <button
              onClick={addCountry}
              className="bg-mynavy hover:bg-myblue text-white text-xs py-2 rounded border border-myamber/50 hover:border-myamber transition-all flex flex-col items-center justify-center gap-1 shadow-lg"
            >
              + Country
            </button>
          </div>
          <button
            onClick={addRegion}
            className="w-full bg-blue-900/50 hover:bg-blue-800 text-blue-200 text-xs py-2 rounded border border-blue-700 hover:border-blue-500 transition-all flex items-center justify-center gap-1 shadow-lg"
          >
            + Region
          </button>
          {geoSummary.countries.length || geoSummary.regions.length || geoSummary.branches.length ? (
            <div className="mt-2 px-2 text-[10px] text-gray-400 space-y-1">
              {geoSummary.countries.map((c) => (
                <div key={c.id} className="flex justify-between">
                  <span>Country</span>
                  <span className="font-mono">{c.code}</span>
                </div>
              ))}
              {geoSummary.regions.map((r) => (
                <div key={r.id} className="flex justify-between">
                  <span>Region</span>
                  <span className="font-mono">{r.code}</span>
                </div>
              ))}
              {geoSummary.branches.map((b) => (
                <div key={b.id} className="flex justify-between">
                  <span>Branch</span>
                  <span className="font-mono">{b.name}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </nav>
    </aside>
  )
}
