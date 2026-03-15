// app/log-history/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { AdminShell } from "@/components/dashboard/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type AuditLogRow = {
  id: string
  actorEmail?: string | null
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export default function LogHistoryPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [message, setMessage] = useState("")
  const [query, setQuery] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [entityFilter, setEntityFilter] = useState("all")
  const [actorFilter, setActorFilter] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  async function load() {
    setStatus("loading")
    setMessage("")
    try {
      const params = new URLSearchParams()
      if (actionFilter !== "all") params.set("action", actionFilter)
      if (entityFilter !== "all") params.set("entity", entityFilter)
      if (actorFilter.trim()) params.set("actor", actorFilter.trim())
      if (fromDate) params.set("from", fromDate)
      if (toDate) params.set("to", toDate)
      const res = await fetch(`/api/audit?${params.toString()}`)
      if (!res.ok) throw new Error("Unable to load log data")
      const data = await res.json()
      setLogs(Array.isArray(data.logs) ? data.logs : [])
      setStatus("idle")
    } catch (err) {
      setStatus("error")
      setMessage(err instanceof Error ? err.message : "Failed to load logs")
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase()
    return logs.filter((log) => {
      if (actionFilter !== "all" && log.action !== actionFilter) return false
      if (entityFilter !== "all" && log.entityType !== entityFilter) return false
      if (!q) return true
      const blob = `${log.actorEmail || ""} ${log.action} ${log.entityType} ${log.entityId || ""} ${JSON.stringify(log.metadata || {})}`
        .toLowerCase()
      return blob.includes(q)
    })
  }, [logs, query, actionFilter, entityFilter])

  function exportCsv() {
    if (!filteredLogs.length) return
    const header = ["createdAt", "actorEmail", "action", "entityType", "entityId", "metadata"]
    const rows = filteredLogs.map((log) => [
      log.createdAt,
      log.actorEmail || "",
      log.action,
      log.entityType,
      log.entityId || "",
      JSON.stringify(log.metadata || {})
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/\"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <AdminShell title="Log History" subtitle="System events and audit traces">
      <Card className="bg-white dark:bg-mydark">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-mynavy dark:text-white">Live Activity Stream</h3>
              <p className="text-xs text-gray-500">Security, data, and operations history.</p>
            </div>
            <button
              onClick={load}
              className="text-xs font-bold px-3 py-2 rounded-full border border-myamber/40 text-myamber hover:bg-myamber/10 transition-colors"
            >
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <input
              className="lg:col-span-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
              placeholder="Search actor, action, entity, metadata..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <input
              className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
              placeholder="Actor email"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
            />
            <select
              className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="all">All Actions</option>
              {[...new Set(logs.map((l) => l.action))].map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
            >
              <option value="all">All Entities</option>
              {[...new Set(logs.map((l) => l.entityType))].map((entity) => (
                <option key={entity} value={entity}>
                  {entity}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="date"
              className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <input
              type="date"
              className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
            <button
              onClick={load}
              className="text-xs font-bold px-3 py-2 rounded-full border border-myamber/40 text-myamber hover:bg-myamber/10 transition-colors"
            >
              Apply Filters
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{filteredLogs.length} of {logs.length} events</span>
            <button
              onClick={exportCsv}
              className="text-xs font-bold px-3 py-2 rounded-full border border-gray-400/40 text-gray-600 hover:bg-gray-200/30 transition-colors"
            >
              Export CSV
            </button>
          </div>

          {status === "loading" ? (
            <p className="text-sm text-gray-500">Loading activity...</p>
          ) : filteredLogs.length === 0 ? (
            <p className="text-sm text-gray-500">No log entries yet.</p>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {log.action} • {log.entityType}
                    </p>
                    <p className="text-xs text-gray-500">
                      {log.actorEmail || "system"} {log.entityId ? `• ${log.entityId}` : ""}
                    </p>
                    {log.metadata ? (
                      <p className="text-[11px] text-gray-400">
                        {JSON.stringify(log.metadata).slice(0, 120)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-600 text-white">audit</Badge>
                    <span className="text-[11px] text-gray-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {status === "error" && (
            <p className="text-xs text-red-500">{message || "Unable to load logs."}</p>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  )
}
