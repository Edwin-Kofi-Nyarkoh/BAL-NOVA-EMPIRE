// app/system-config/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { AdminShell } from "@/components/dashboard/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useDialog } from "@/components/ui/dialog-service"

type UserRow = {
  id: string
  name: string | null
  email: string
  role: string
  approvalStatus?: string
  createdAt: string
}

type RiderAdminRow = {
  id: string
  name: string | null
  email: string | null
  riderState?: {
    status?: string | null
    pendingCash?: number | null
    currentVol?: number | null
    lastLat?: number | null
    lastLng?: number | null
    lastLocationAt?: string | null
  } | null
  riderTasks?: { id: string; type: string; loc: string; status: string }[]
}

type OrderRow = {
  id: string
  item: string
  price: number
  status: string
  riderId?: string | null
  createdAt: string
}

export default function SystemConfigPage() {
  const dialog = useDialog()
  const [users, setUsers] = useState<UserRow[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [message, setMessage] = useState("")
  const [creating, setCreating] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [backfillStatus, setBackfillStatus] = useState<"idle" | "running" | "done">("idle")
  const [approvalFilter, setApprovalFilter] = useState<"all" | "pending" | "approved" | "rejected">("all")
  const [search, setSearch] = useState("")
  const [baySettings, setBaySettings] = useState({
    capacity: "85",
    hotPct: "80",
    bayACapacity: "",
    bayBCapacity: "",
    bayAHotPct: "",
    bayBHotPct: "",
    autoHot: true
  })
  const [savingBaySettings, setSavingBaySettings] = useState(false)
  const [resettingRiderCash, setResettingRiderCash] = useState(false)
  const [riderAdminRows, setRiderAdminRows] = useState<RiderAdminRow[]>([])
  const [loadingRiders, setLoadingRiders] = useState(false)
  const [assignOrderId, setAssignOrderId] = useState("")
  const [assignRiderId, setAssignRiderId] = useState("")
  const [assigningOrder, setAssigningOrder] = useState(false)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [dispatchRadiusKm, setDispatchRadiusKm] = useState("")
  const [savingDispatchRadius, setSavingDispatchRadius] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" })

  const canSubmit = useMemo(() => {
    return form.name.trim() && form.email.trim() && form.password.trim().length >= 8
  }, [form])
  const pendingCount = useMemo(() => {
    return users.filter((u) => (u.approvalStatus || "approved") === "pending").length
  }, [users])

  async function loadUsers() {
    setStatus("loading")
    setMessage("")
    try {
      const res = await fetch("/api/users")
      if (!res.ok) throw new Error("Unable to load users")
      const data = await res.json()
      setUsers(Array.isArray(data.users) ? data.users : [])
      setStatus("idle")
    } catch (err) {
      setStatus("error")
      setMessage(err instanceof Error ? err.message : "Failed to load users")
    }
  }

  async function createUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSubmit || creating) return
    setCreating(true)
    setMessage("")
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create user")
      }
      setForm({ name: "", email: "", password: "", role: "user" })
      await loadUsers()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to create user")
    } finally {
      setCreating(false)
    }
  }

  async function updateUser(id: string, payload: { role?: string; password?: string; approvalStatus?: string }) {
    setBusyUserId(id)
    setMessage("")
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Update failed")
      }
      await loadUsers()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Update failed")
    } finally {
      setBusyUserId(null)
    }
  }

  async function promptResetPassword(id: string) {
    const value = await dialog.prompt("Enter a temporary password (min 8 characters)", {
      placeholder: "Temporary password"
    })
    if (!value) return
    await updateUser(id, { password: value })
  }

  async function backfillOrderUsers() {
    const ok = await dialog.confirm("Backfill order owners from existing ledger entries?")
    if (!ok) {
      return
    }
    setBackfillStatus("running")
    setMessage("")
    try {
      const res = await fetch("/api/orders/backfill-user", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Backfill failed")
      setBackfillStatus("done")
      setMessage(`Backfill updated ${data?.updated ?? 0} orders.`)
    } catch (err) {
      setBackfillStatus("idle")
      setMessage(err instanceof Error ? err.message : "Backfill failed")
    }
  }

  useEffect(() => {
    loadUsers()
    void loadBaySettings()
    void loadRiders()
    void loadOrders()
    void loadSystemSettings()
  }, [])

  async function loadBaySettings() {
    try {
      const res = await fetch("/api/settings")
      const data = await res.json().catch(() => ({}))
    if (data?.settings?.bayCapacity) {
      setBaySettings((prev) => ({ ...prev, capacity: String(data.settings.bayCapacity) }))
    }
    if (data?.settings?.bayHotPct) {
      setBaySettings((prev) => ({ ...prev, hotPct: String(data.settings.bayHotPct) }))
    }
    if (data?.settings?.bayACapacity) {
      setBaySettings((prev) => ({ ...prev, bayACapacity: String(data.settings.bayACapacity) }))
    }
    if (data?.settings?.bayBCapacity) {
      setBaySettings((prev) => ({ ...prev, bayBCapacity: String(data.settings.bayBCapacity) }))
    }
    if (data?.settings?.bayAHotPct) {
      setBaySettings((prev) => ({ ...prev, bayAHotPct: String(data.settings.bayAHotPct) }))
    }
    if (data?.settings?.bayBHotPct) {
      setBaySettings((prev) => ({ ...prev, bayBHotPct: String(data.settings.bayBHotPct) }))
    }
    if (typeof data?.settings?.bayAutoHot === "boolean") {
      setBaySettings((prev) => ({ ...prev, autoHot: data.settings.bayAutoHot }))
    }
  } catch {
      // ignore
  }
  }

  async function saveBaySettings() {
    const capacity = Number(baySettings.capacity || 85)
    const hotPct = Number(baySettings.hotPct || 80)
    const bayACapacity = Number(baySettings.bayACapacity || 0) || undefined
    const bayBCapacity = Number(baySettings.bayBCapacity || 0) || undefined
    const bayAHotPct = Number(baySettings.bayAHotPct || 0) || undefined
    const bayBHotPct = Number(baySettings.bayBHotPct || 0) || undefined
    const bayAutoHot = baySettings.autoHot
    setSavingBaySettings(true)
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bayCapacity: capacity,
          bayHotPct: hotPct,
          bayACapacity,
          bayBCapacity,
          bayAHotPct,
          bayBHotPct,
          bayAutoHot
        })
      })
    } finally {
      setSavingBaySettings(false)
    }
  }

  async function loadRiders() {
    setLoadingRiders(true)
    try {
      const res = await fetch("/api/rider/admin")
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setRiderAdminRows(Array.isArray(data.riders) ? data.riders : [])
      }
    } finally {
      setLoadingRiders(false)
    }
  }

  async function loadOrders() {
    setLoadingOrders(true)
    try {
      const res = await fetch("/api/orders?all=1")
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setOrders(Array.isArray(data.orders) ? data.orders : [])
      }
    } finally {
      setLoadingOrders(false)
    }
  }

  async function loadSystemSettings() {
    try {
      const res = await fetch("/api/system-settings")
      const data = await res.json().catch(() => ({}))
      if (res.ok && typeof data?.settings?.dispatchRadiusKm === "number") {
        setDispatchRadiusKm(String(data.settings.dispatchRadiusKm))
      }
    } catch {
      // ignore
    }
  }

  async function saveDispatchRadius() {
    const value = Number(dispatchRadiusKm)
    if (!Number.isFinite(value) || value <= 0) {
      setMessage("Dispatch radius must be a positive number.")
      return
    }
    setSavingDispatchRadius(true)
    setMessage("")
    try {
      const res = await fetch("/api/system-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dispatchRadiusKm: value })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Save failed")
      setMessage("Dispatch radius saved.")
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSavingDispatchRadius(false)
    }
  }

  async function clearRiderTasks(riderId: string) {
    const ok = await dialog.confirm("Clear all active tasks for this rider?")
    if (!ok) return
    await fetch("/api/rider/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear_tasks", riderId })
    })
    await loadRiders()
  }

  async function assignOrderToRider() {
    if (!assignOrderId.trim() || !assignRiderId.trim()) {
      setMessage("Order ID and Rider are required.")
      return
    }
    setAssigningOrder(true)
    setMessage("")
    try {
      const res = await fetch("/api/rider/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", orderId: assignOrderId.trim(), riderId: assignRiderId })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Assign failed")
      setMessage("Order assigned to rider.")
      setAssignOrderId("")
      await loadRiders()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Assign failed")
    } finally {
      setAssigningOrder(false)
    }
  }

  async function resetRiderCash() {
    const ok = await dialog.confirm("Reset pending rider cash for all riders?")
    if (!ok) return
    setResettingRiderCash(true)
    setMessage("")
    try {
      const res = await fetch("/api/rider/reset", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Reset failed")
      }
      setMessage(`Rider cash reset for ${data?.updated ?? 0} accounts.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Reset failed")
    } finally {
      setResettingRiderCash(false)
    }
  }

  return (
    <AdminShell title="System Config" subtitle="Security, roles, and platform settings">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-white dark:bg-mydark lg:col-span-2">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-mynavy dark:text-white">User Directory</h3>
                  {pendingCount > 0 ? (
                    <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">
                      {pendingCount} pending
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-gray-500">Admin-only view of all platform accounts.</p>
              </div>
              <button
                onClick={loadUsers}
                className="text-xs font-bold px-3 py-2 rounded-full border border-myamber/40 text-myamber hover:bg-myamber/10 transition-colors"
              >
                Refresh
              </button>
              <button
                onClick={backfillOrderUsers}
                className="text-xs font-bold px-3 py-2 rounded-full border border-blue-500/40 text-blue-600 hover:bg-blue-500/10 transition-colors"
              >
                {backfillStatus === "running" ? "Backfilling..." : "Backfill Order Owners"}
              </button>
            </div>

            {status === "loading" ? (
              <p className="text-sm text-gray-500">Loading users...</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-gray-500">No users found.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {(["all", "pending", "approved", "rejected"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setApprovalFilter(filter)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                        approvalFilter === filter
                          ? "border-myamber text-myamber bg-myamber/10"
                          : "border-gray-200/60 dark:border-white/10 text-gray-500 hover:bg-gray-100/50 dark:hover:bg-white/5"
                      }`}
                    >
                      {filter === "all" ? "All" : filter[0].toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or email"
                    className="ml-auto w-full sm:w-64 rounded-full border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-1.5 text-xs"
                  />
                </div>
                {users
                  .filter((u) => {
                    if (approvalFilter === "all") return true
                    return (u.approvalStatus || "approved") === approvalFilter
                  })
                  .filter((u) => {
                    const term = search.trim().toLowerCase()
                    if (!term) return true
                    return (u.name || "").toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
                  })
                  .map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {u.name || "Unnamed User"}
                      </p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={u.role === "admin" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-800"}>
                        {u.role}
                      </Badge>
                      <Badge
                        className={
                          u.approvalStatus === "approved"
                            ? "bg-emerald-600 text-white"
                            : u.approvalStatus === "rejected"
                              ? "bg-red-600 text-white"
                              : "bg-amber-500 text-white"
                        }
                      >
                        {u.approvalStatus || "approved"}
                      </Badge>
                      <span className="text-[11px] text-gray-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                      <div className="hidden sm:flex items-center gap-2 pl-2">
                        {u.role !== "admin" ? (
                          <button
                            onClick={() => updateUser(u.id, { role: "admin" })}
                            disabled={busyUserId === u.id}
                            className="text-xs font-bold px-2.5 py-1 rounded-full border border-green-500/40 text-green-600 hover:bg-green-500/10 disabled:opacity-60"
                          >
                            Make Admin
                          </button>
                        ) : (
                          <button
                            onClick={() => updateUser(u.id, { role: "user" })}
                            disabled={busyUserId === u.id}
                            className="text-xs font-bold px-2.5 py-1 rounded-full border border-gray-400/40 text-gray-500 hover:bg-gray-200/30 disabled:opacity-60"
                          >
                            Make User
                          </button>
                        )}
                        {u.approvalStatus === "pending" ? (
                          <>
                            <button
                              onClick={() => updateUser(u.id, { approvalStatus: "approved" })}
                              disabled={busyUserId === u.id}
                              className="text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-60"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => updateUser(u.id, { approvalStatus: "rejected" })}
                              disabled={busyUserId === u.id}
                              className="text-xs font-bold px-2.5 py-1 rounded-full border border-red-500/40 text-red-600 hover:bg-red-500/10 disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                        <button
                          onClick={() => promptResetPassword(u.id)}
                          disabled={busyUserId === u.id}
                          className="text-xs font-bold px-2.5 py-1 rounded-full border border-myamber/40 text-myamber hover:bg-myamber/10 disabled:opacity-60"
                        >
                          Reset Password
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(status === "error" || message) && (
              <p className="text-xs text-red-500">{message || "Unable to load users."}</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-mydark">
          <CardContent className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-mynavy dark:text-white">Create User</h3>
              <p className="text-xs text-gray-500">Admins can create users and assign roles.</p>
            </div>
            <form className="space-y-3" onSubmit={createUser}>
              <input
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <input
                type="email"
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                placeholder="Email address"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
              <input
                type="password"
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                placeholder="Temporary password (min 8 chars)"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              />
              <select
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
              >
                <option value="user">User</option>
                <option value="vendor">Vendor</option>
                <option value="rider">Rider</option>
                <option value="reseller">Reseller</option>
                <option value="pro">Pro</option>
                <option value="admin">Admin</option>
              </select>
              <button
                type="submit"
                disabled={!canSubmit || creating}
                className="w-full rounded-lg bg-myamber text-black text-sm font-bold py-2 disabled:opacity-60"
              >
                {creating ? "Creating..." : "Create User"}
              </button>
              {message && (
                <p className="text-xs text-red-500">{message}</p>
              )}
            </form>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-mydark lg:col-span-3">
          <CardContent className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-mynavy dark:text-white">Dispatch Bay Settings</h3>
              <p className="text-xs text-gray-500">Configure bay capacity and hot threshold.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                placeholder="Bay capacity (default 85)"
                value={baySettings.capacity}
                onChange={(e) => setBaySettings((prev) => ({ ...prev, capacity: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                placeholder="Hot threshold % (default 80)"
                value={baySettings.hotPct}
                onChange={(e) => setBaySettings((prev) => ({ ...prev, hotPct: e.target.value }))}
              />
              <button
                onClick={saveBaySettings}
                className="rounded-lg bg-myamber text-black text-sm font-bold py-2"
                disabled={savingBaySettings}
              >
                {savingBaySettings ? "Saving..." : "Save Bay Settings"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={resetRiderCash}
                disabled={resettingRiderCash}
                className="rounded-lg border border-red-500/40 text-red-600 text-xs font-bold px-4 py-2 hover:bg-red-500/10 disabled:opacity-60"
              >
                {resettingRiderCash ? "Resetting..." : "Reset Rider Cash"}
              </button>
              <p className="text-[11px] text-gray-500">
                Clears pending rider cash for all rider accounts.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                placeholder="Bay A capacity (override)"
                value={baySettings.bayACapacity}
                onChange={(e) => setBaySettings((prev) => ({ ...prev, bayACapacity: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                placeholder="Bay A hot %"
                value={baySettings.bayAHotPct}
                onChange={(e) => setBaySettings((prev) => ({ ...prev, bayAHotPct: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                placeholder="Bay B capacity (override)"
                value={baySettings.bayBCapacity}
                onChange={(e) => setBaySettings((prev) => ({ ...prev, bayBCapacity: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                placeholder="Bay B hot %"
                value={baySettings.bayBHotPct}
                onChange={(e) => setBaySettings((prev) => ({ ...prev, bayBHotPct: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={baySettings.autoHot}
                onChange={(e) => setBaySettings((prev) => ({ ...prev, autoHot: e.target.checked }))}
              />
              Auto-hot highlight (disable to suppress bay warnings)
            </label>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-mydark lg:col-span-3">
          <CardContent className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-mynavy dark:text-white">Dispatch Radius</h3>
              <p className="text-xs text-gray-500">Limit auto-assign to riders within this radius (km).</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                className="w-40 rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                placeholder="Radius (km)"
                value={dispatchRadiusKm}
                onChange={(e) => setDispatchRadiusKm(e.target.value)}
              />
              <button
                onClick={saveDispatchRadius}
                disabled={savingDispatchRadius}
                className="rounded-lg bg-myamber text-black text-sm font-bold px-4 py-2 disabled:opacity-60"
              >
                {savingDispatchRadius ? "Saving..." : "Save Radius"}
              </button>
              <span className="text-[11px] text-gray-500">
                Defaults to env `DISPATCH_RADIUS_KM` if blank.
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-mydark lg:col-span-3">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-mynavy dark:text-white">Rider Dispatch Control</h3>
                <p className="text-xs text-gray-500">Assign orders and clear active rider tasks.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadRiders}
                  className="text-xs font-bold px-3 py-2 rounded-full border border-myamber/40 text-myamber hover:bg-myamber/10 transition-colors"
                >
                  Refresh Riders
                </button>
                <button
                  onClick={loadOrders}
                  className="text-xs font-bold px-3 py-2 rounded-full border border-blue-500/40 text-blue-600 hover:bg-blue-500/10 transition-colors"
                >
                  Refresh Orders
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                value={assignOrderId}
                onChange={(e) => setAssignOrderId(e.target.value)}
              >
                <option value="">{loadingOrders ? "Loading orders..." : "Select Order"}</option>
                {orders
                  .filter((o) => o.status !== "Delivered" && !o.riderId)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.item} · GHS {Number(o.price || 0).toFixed(2)} · {o.id.slice(-6)}
                    </option>
                  ))}
              </select>
              <select
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                value={assignRiderId}
                onChange={(e) => setAssignRiderId(e.target.value)}
              >
                <option value="">Select Rider</option>
                {riderAdminRows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name || r.email || r.id}
                  </option>
                ))}
              </select>
              <button
                onClick={assignOrderToRider}
                disabled={assigningOrder}
                className="rounded-lg bg-myamber text-black text-sm font-bold py-2 disabled:opacity-60"
              >
                {assigningOrder ? "Assigning..." : "Assign Order"}
              </button>
            </div>

            {loadingRiders ? (
              <p className="text-sm text-gray-500">Loading riders...</p>
            ) : riderAdminRows.length === 0 ? (
              <p className="text-sm text-gray-500">No riders found.</p>
            ) : (
              <div className="space-y-3">
                {riderAdminRows.map((rider) => (
                  <div
                    key={rider.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {rider.name || "Unnamed Rider"}
                      </p>
                      <p className="text-xs text-gray-500">{rider.email || rider.id}</p>
                      <p className="text-[11px] text-gray-400">
                        Status: {rider.riderState?.status || "Idle"} · Cash: GHS{" "}
                        {(rider.riderState?.pendingCash || 0).toFixed(2)} · Vol: {rider.riderState?.currentVol || 0}%
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-500">
                        Active tasks: {rider.riderTasks?.length || 0}
                      </span>
                      <button
                        onClick={() => clearRiderTasks(rider.id)}
                        className="text-xs font-bold px-3 py-1 rounded-full border border-red-500/40 text-red-600 hover:bg-red-500/10"
                      >
                        Clear Tasks
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  )
}
