// app/qc-firewall/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { AdminShell } from "@/components/dashboard/admin-shell"
import { Card, CardContent } from "@/components/ui/card"

type AuditLog = {
  id: string
  actorEmail?: string | null
  action: string
  entityType: string
  entityId?: string | null
  createdAt: string
}

export default function QCFirewallPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")

  useEffect(() => {
    let active = true
    async function load() {
      setStatus("loading")
      try {
        const res = await fetch("/api/audit?take=120")
        const data = await res.json().catch(() => ({}))
        if (!active) return
        setLogs(Array.isArray(data.logs) ? data.logs : [])
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

  const actionCounts = useMemo(() => {
    return logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }, [logs])

  const entityCounts = useMemo(() => {
    return logs.reduce((acc, log) => {
      acc[log.entityType] = (acc[log.entityType] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }, [logs])

  const recent = logs.slice(0, 10)

  return (
    <AdminShell title="QC Firewall" subtitle="Compliance checks and security validation">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-white dark:bg-mydark lg:col-span-2">
          <CardContent className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-mynavy dark:text-white">Compliance Activity</h3>
              <p className="text-xs text-gray-500">Audit log events across the platform.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.keys(entityCounts).length === 0 ? (
                <div className="text-sm text-gray-500">No audit events yet.</div>
              ) : (
                Object.entries(entityCounts).map(([entity, count]) => (
                  <div key={entity} className="rounded-xl border border-gray-200/70 dark:border-white/10 p-4">
                    <p className="text-xs text-gray-500 uppercase">{entity}</p>
                    <p className="text-xl font-bold text-mynavy dark:text-white">{count}</p>
                  </div>
                ))
              )}
            </div>
            {status === "error" ? <p className="text-xs text-red-500">Unable to load audit logs.</p> : null}
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-mydark">
          <CardContent className="p-6 space-y-3">
            <h3 className="text-sm font-bold text-gray-500 uppercase">Actions</h3>
            {Object.keys(actionCounts).length === 0 ? (
              <p className="text-sm text-gray-500">No actions yet.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(actionCounts).map(([action, count]) => (
                  <div key={action} className="flex items-center justify-between text-sm">
                    <span className="truncate">{action}</span>
                    <span className="font-bold text-mynavy dark:text-white">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mt-6 relative">
        <div className="scanning-line opacity-30" />
        <CardContent className="p-0">
          <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 pulse-dot" />
              Live QC Logs
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase">
                <tr>
                  <th className="p-4">Action</th>
                  <th className="p-4">Entity</th>
                  <th className="p-4">Actor</th>
                  <th className="p-4">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm dark:text-white">
                {recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-sm text-gray-500">
                      No audit events recorded.
                    </td>
                  </tr>
                ) : (
                  recent.map((log) => (
                    <tr key={log.id}>
                      <td className="p-4 font-semibold">{log.action}</td>
                      <td className="p-4 text-xs text-gray-400">{log.entityType}</td>
                      <td className="p-4 text-xs text-gray-400">{log.actorEmail || "system"}</td>
                      <td className="p-4 text-xs text-gray-400">{new Date(log.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AdminShell>
  )
}
