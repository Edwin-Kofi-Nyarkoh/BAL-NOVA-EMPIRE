// app/service-network/page.tsx
"use client"

import { useMemo } from "react"
import { AdminShell } from "@/components/dashboard/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { useAdminProsQuery } from "@/lib/query"

export default function ServiceNetworkPage() {
  const prosQuery = useAdminProsQuery()
  const pros = prosQuery.data || []
  const status = prosQuery.isError ? "error" : "idle"

  const totalTeams = useMemo(() => pros.reduce((sum, p) => sum + p.teamCount, 0), [pros])
  const recent = pros.slice(0, 6)

  return (
    <AdminShell title="Service Network" subtitle="Professionals, coverage, and SLA">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-mydark">
          <CardContent className="p-6">
            <p className="text-xs text-gray-500 uppercase">Active Pros</p>
            <p className="text-2xl font-bold text-mynavy dark:text-white">{pros.length}</p>
            <p className="text-[10px] text-gray-400">Portfolios onboarded</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-mydark">
          <CardContent className="p-6">
            <p className="text-xs text-gray-500 uppercase">Teams</p>
            <p className="text-2xl font-bold text-blue-600">{totalTeams}</p>
            <p className="text-[10px] text-gray-400">Active crew members</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-mydark">
          <CardContent className="p-6">
            <p className="text-xs text-gray-500 uppercase">Coverage</p>
            <p className="text-2xl font-bold text-green-600">{pros.length ? "Live" : "--"}</p>
            <p className="text-[10px] text-gray-400">Based on active portfolios</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mt-6 relative overflow-hidden">
        <div className="scanning-line opacity-30" />
        <h3 className="font-bold text-lg dark:text-white mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 pulse-dot" />
          Service Network
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="p-4">Portfolio</th>
                <th className="p-4">Team</th>
                <th className="p-4">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 dark:text-gray-300">
              {status === "error" ? (
                <tr>
                  <td colSpan={3} className="p-4 text-sm text-red-500">
                    Unable to load service network.
                  </td>
                </tr>
              ) : recent.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-4 text-sm text-gray-500">
                    No service pros yet.
                  </td>
                </tr>
              ) : (
                recent.map((p) => (
                  <tr key={p.id}>
                    <td className="p-4 font-semibold">{p.summary}</td>
                    <td className="p-4 text-xs text-gray-500">{p.teamCount}</td>
                    <td className="p-4 text-xs text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</td>
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
