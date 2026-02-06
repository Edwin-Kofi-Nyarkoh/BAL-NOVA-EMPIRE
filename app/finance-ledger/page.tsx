"use client"

import { useEffect, useMemo, useState } from "react"
import { AdminShell } from "@/components/dashboard/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { cn, formatCurrency } from "@/lib/utils"

type LedgerEntry = {
  id: string
  userId: string
  orderId?: string | null
  type: string
  amount: number
  status: string
  note?: string | null
  createdAt: string
}

type UserRow = {
  id: string
  name: string | null
  email: string
}

export default function FinanceLedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [message, setMessage] = useState("")
  const [filters, setFilters] = useState({ type: "", status: "", userId: "", limit: 50 })
  const [form, setForm] = useState({ userId: "", type: "REVENUE", amount: "", status: "manual", note: "" })
  const [backfillStatus, setBackfillStatus] = useState<"idle" | "running" | "done">("idle")

  const total = useMemo(() => entries.reduce((sum, e) => sum + e.amount, 0), [entries])
  const totalsByType = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        acc[entry.type] = (acc[entry.type] || 0) + entry.amount
        return acc
      },
      {} as Record<string, number>
    )
  }, [entries])

  async function readJsonSafe(res: Response) {
    const text = await res.text()
    if (!text) return {}
    try {
      return JSON.parse(text)
    } catch {
      return {}
    }
  }

  async function loadUsers() {
    const res = await fetch("/api/users")
    const data = await readJsonSafe(res)
    if (!res.ok) {
      return
    }
    setUsers(Array.isArray(data.users) ? data.users : [])
  }

  async function loadEntries() {
    setStatus("loading")
    setMessage("")
    try {
      const params = new URLSearchParams()
      if (filters.type) params.set("type", filters.type)
      if (filters.status) params.set("status", filters.status)
      if (filters.userId) params.set("userId", filters.userId)
      params.set("limit", String(filters.limit || 50))
      const res = await fetch(`/api/finance/ledger?${params.toString()}`)
      const data = await readJsonSafe(res)
      if (!res.ok) {
        if (res.status === 401) {
          setMessage("Not signed in. Please log in to view ledger data.")
        } else if (res.status === 403) {
          setMessage("Admin access required. Switch to an admin account to view the ledger.")
        }
        const hint = res.status === 401 ? "Not signed in." : res.status === 403 ? "Admin access required." : ""
        throw new Error(data?.error || `Failed to load ledger. ${hint}`.trim())
      }
      setEntries(Array.isArray(data.entries) ? data.entries : [])
      setStatus("idle")
    } catch (err) {
      setStatus("error")
      setMessage(err instanceof Error ? err.message : "Failed to load ledger")
    }
  }

  async function createEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.userId || !form.type || !form.amount) return
    setMessage("")
    try {
      const res = await fetch("/api/finance/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: form.userId,
          type: form.type,
          amount: Number(form.amount),
          status: form.status,
          note: form.note
        })
      })
      const data = await readJsonSafe(res)
      if (!res.ok) throw new Error(data?.error || "Failed to create entry")
      setForm({ userId: form.userId, type: "REVENUE", amount: "", status: "manual", note: "" })
      await loadEntries()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to create entry")
    }
  }

  async function updateEntry(id: string, payload: { amount?: number; status?: string; note?: string }) {
    const res = await fetch(`/api/finance/ledger/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const data = await readJsonSafe(res)
      setMessage(data?.error || "Update failed")
      return
    }
    await loadEntries()
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this ledger entry?")) return
    const res = await fetch(`/api/finance/ledger/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const data = await readJsonSafe(res)
      setMessage(data?.error || "Delete failed")
      return
    }
    await loadEntries()
  }

  async function backfill() {
    setBackfillStatus("running")
    const res = await fetch("/api/finance/ledger/backfill", { method: "POST" })
    const data = await readJsonSafe(res)
    setBackfillStatus("done")
    setMessage(`Backfill created ${data?.created ?? 0} ledger entries.`)
    await loadEntries()
  }

  useEffect(() => {
    loadUsers()
    loadEntries()
  }, [])

  function exportCsvRows(rows: string[][]) {
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `ledger-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function buildRows(list: LedgerEntry[], includeUserName: boolean) {
    const userMap = new Map(users.map((u) => [u.id, u.name || u.email]))
    const header = includeUserName
      ? ["id", "userId", "userName", "orderId", "type", "amount", "status", "note", "createdAt"]
      : ["id", "userId", "orderId", "type", "amount", "status", "note", "createdAt"]
    return [
      header,
      ...list.map((e) => {
        const base = [
          e.id,
          e.userId,
          e.orderId || "",
          e.type,
          String(e.amount),
          e.status,
          (e.note || "").replaceAll('"', '""'),
          e.createdAt
        ]
        if (!includeUserName) return base
        return [
          e.id,
          e.userId,
          userMap.get(e.userId) || "",
          e.orderId || "",
          e.type,
          String(e.amount),
          e.status,
          (e.note || "").replaceAll('"', '""'),
          e.createdAt
        ]
      })
    ]
  }

  function exportCsv() {
    if (entries.length === 0) return
    exportCsvRows(buildRows(entries, true))
  }

  async function exportFilteredCsv() {
    const params = new URLSearchParams()
    if (filters.type) params.set("type", filters.type)
    if (filters.status) params.set("status", filters.status)
    if (filters.userId) params.set("userId", filters.userId)
    params.set("limit", "200")
    const res = await fetch(`/api/finance/ledger?${params.toString()}`)
    const data = await readJsonSafe(res)
    if (!res.ok) {
      setMessage(data?.error || "Export failed")
      return
    }
    const list = Array.isArray(data.entries) ? data.entries : []
    exportCsvRows(buildRows(list, true))
  }

  return (
    <AdminShell title="Finance Ledger" subtitle="Ledger entries and manual adjustments">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-white dark:bg-mydark lg:col-span-2">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-mynavy dark:text-white">Ledger Entries</h3>
                <p className="text-xs text-gray-500">Latest financial postings.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={backfill}
                  className="text-xs font-bold px-3 py-2 rounded-full border border-myamber/40 text-myamber hover:bg-myamber/10 transition-colors"
                >
                  {backfillStatus === "running" ? "Backfilling..." : "Backfill From Orders"}
                </button>
                <button
                  onClick={exportCsv}
                  className="text-xs font-bold px-3 py-2 rounded-full border border-blue-500/40 text-blue-600 hover:bg-blue-500/10 transition-colors"
                >
                  Export CSV
                </button>
                <button
                  onClick={exportFilteredCsv}
                  className="text-xs font-bold px-3 py-2 rounded-full border border-purple-500/40 text-purple-600 hover:bg-purple-500/10 transition-colors"
                >
                  Export Filtered
                </button>
                <button
                  onClick={loadEntries}
                  className="text-xs font-bold px-3 py-2 rounded-full border border-gray-200 dark:border-white/10 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={filters.userId}
                onChange={(e) => setFilters((prev) => ({ ...prev, userId: e.target.value }))}
                className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-xs"
              >
                <option value="">All Users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
              <select
                value={filters.type}
                onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
                className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-xs"
              >
                <option value="">All Types</option>
                <option value="REVENUE">REVENUE</option>
                <option value="ESCROW">ESCROW</option>
                <option value="ADJUSTMENT">ADJUSTMENT</option>
              </select>
              <select
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-xs"
              >
                <option value="">All Status</option>
                <option value="posted">posted</option>
                <option value="manual">manual</option>
              </select>
              <select
                value={filters.limit}
                onChange={(e) => setFilters((prev) => ({ ...prev, limit: Number(e.target.value) }))}
                className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-xs"
              >
                {[25, 50, 100, 200].map((n) => (
                  <option key={n} value={n}>
                    Last {n}
                  </option>
                ))}
              </select>
              <button
                onClick={loadEntries}
                className="text-xs font-bold px-3 py-2 rounded-lg bg-myamber text-mynavy"
              >
                Apply
              </button>
            </div>

            <div className="rounded-xl border border-gray-200/70 dark:border-white/10 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-white/5 text-xs text-gray-500">
                <span>Total (shown): {formatCurrency(total)}</span>
                <span>{entries.length} entries</span>
              </div>
              <div className="flex flex-wrap gap-2 px-4 py-2 border-b border-gray-200/70 dark:border-white/10 text-[11px] text-gray-500">
                {Object.keys(totalsByType).length === 0 ? (
                  <span>No totals yet.</span>
                ) : (
                  Object.entries(totalsByType).map(([key, value]) => (
                    <span key={key} className="px-2 py-1 rounded-full bg-white/60 dark:bg-white/5 border border-gray-200/70 dark:border-white/10">
                      {key}: {formatCurrency(value)}
                    </span>
                  ))
                )}
              </div>
              <div className="divide-y divide-gray-200/70 dark:divide-white/10">
                {status === "loading" ? (
                  <div className="p-4 text-sm text-gray-500">Loading ledger...</div>
                ) : entries.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">No ledger entries found.</div>
                ) : (
                  entries.map((e) => (
                    <div key={e.id} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {e.type} - {formatCurrency(e.amount)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {e.note || "No note"} · {new Date(e.createdAt).toLocaleString()}
                        </p>
                        <p className="text-[11px] text-gray-400">User: {e.userId}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <select
                          value={e.status}
                          onChange={(evt) => updateEntry(e.id, { status: evt.target.value })}
                          className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2 py-1 text-xs"
                        >
                          <option value="posted">posted</option>
                          <option value="manual">manual</option>
                        </select>
                        <button
                          onClick={() => {
                            const note = prompt("Update note", e.note || "") || ""
                            updateEntry(e.id, { note })
                          }}
                          className="text-myamber font-bold"
                        >
                          Edit Note
                        </button>
                        <button
                          onClick={() => deleteEntry(e.id)}
                          className="text-red-500 font-bold"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {message ? (
              <p
                className={cn(
                  "text-xs rounded-lg border px-3 py-2",
                  message.toLowerCase().includes("admin")
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : message.toLowerCase().includes("log in")
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-red-200 bg-red-50 text-red-600"
                )}
              >
                {message}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-mydark">
          <CardContent className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-mynavy dark:text-white">Manual Adjustment</h3>
              <p className="text-xs text-gray-500">Post a ledger entry manually.</p>
            </div>
            <form className="space-y-3" onSubmit={createEntry}>
              <select
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                value={form.userId}
                onChange={(e) => setForm((prev) => ({ ...prev, userId: e.target.value }))}
              >
                <option value="">Select user</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                  value={form.type}
                  onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                >
                  <option value="REVENUE">REVENUE</option>
                  <option value="ESCROW">ESCROW</option>
                  <option value="ADJUSTMENT">ADJUSTMENT</option>
                </select>
                <input
                  className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                  placeholder="Amount"
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <select
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="manual">manual</option>
                <option value="posted">posted</option>
              </select>
              <input
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                placeholder="Note"
                value={form.note}
                onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-myamber text-black text-sm font-bold py-2 disabled:opacity-60"
                disabled={!form.userId || !form.amount}
              >
                Create Entry
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  )
}
