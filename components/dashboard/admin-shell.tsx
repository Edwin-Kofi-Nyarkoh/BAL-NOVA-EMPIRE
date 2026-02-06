// components/dashboard/admin-shell.tsx
"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { ModeToggle } from "@/components/ui/mode-toggle"
import { LogoutButton } from "@/components/logout-button"
import { cn } from "@/lib/utils"
import { Menu } from "lucide-react"
import { OperationalAlerts } from "@/components/dashboard/operational-alerts"
import { useSession } from "next-auth/react"

type AdminShellProps = {
  title: string
  subtitle?: string
  children: React.ReactNode
}

export function AdminShell({ title, subtitle, children }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [health, setHealth] = useState<"loading" | "ok" | "error">("loading")
  const [healthError, setHealthError] = useState("")
  const [sessionOk, setSessionOk] = useState<"loading" | "ok" | "error">("loading")
  const [sessionError, setSessionError] = useState("")
  const [healthTipOpen, setHealthTipOpen] = useState(false)
  const [authTipOpen, setAuthTipOpen] = useState(false)
  const { data: session, status: sessionStatus } = useSession()
  const role = ((session?.user as any)?.role || "") as string

  useEffect(() => {
    let active = true
    async function checkHealth() {
      try {
        const res = await fetch("/api/health")
        const data = await res.json().catch(() => ({}))
        if (!active) return
        setHealth(data?.db === "ok" ? "ok" : "error")
        setHealthError(data?.error || "")
      } catch {
        if (!active) return
        setHealth("error")
        setHealthError("Health endpoint unreachable.")
      }
    }

    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session")
        if (!active) return
        setSessionOk(res.ok ? "ok" : "error")
        if (!res.ok) {
          setSessionError("Session endpoint returned error.")
        } else {
          setSessionError("")
        }
      } catch {
        if (!active) return
        setSessionOk("error")
        setSessionError("Session endpoint unreachable.")
      }
    }

    checkHealth()
    checkSession()
    const interval = setInterval(() => {
      checkHealth()
      checkSession()
    }, 45000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="bg-white text-gray-800 dark:bg-mydark dark:text-gray-100 overflow-hidden h-screen flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div
        className={cn("fixed inset-0 bg-black/50 z-40 md:hidden", sidebarOpen ? "block" : "hidden")}
        onClick={() => setSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative pt-16 md:pt-0 md:ml-64">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-16 flex items-center justify-between px-6 shrink-0 transition-colors">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-gray-500 hover:text-mynavy"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-xl font-bold text-mynavy dark:text-white">{title}</h2>
              {subtitle ? <p className="text-[10px] text-gray-500 -mt-0.5">{subtitle}</p> : null}
            </div>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            {sessionStatus === "authenticated" && role ? (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-myamber/40 bg-myamber/10 text-myamber text-xs font-bold">
                Role: {role.charAt(0).toUpperCase() + role.slice(1)}
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-300/40 bg-gray-100 text-gray-500 text-xs font-semibold">
                Role: Checking...
              </div>
            )}
            <div className="hidden md:flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-200">GH</span>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Ghana (Active)</span>
            </div>

            <div className="hidden md:flex items-center gap-2 text-xs font-bold text-gray-500 mr-2 border-r border-gray-300 dark:border-gray-600 pr-4 h-8">
              Uplink...
            </div>

            <div className="relative hidden md:block">
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-500 cursor-pointer select-none",
                health === "ok" && "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800",
                health === "error" && "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800",
                health === "loading" && "bg-gray-100 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700"
              )}
                role="button"
                tabIndex={0}
                onClick={() => setHealthTipOpen((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setHealthTipOpen((v) => !v)
                  }
                }}
                onBlur={() => setHealthTipOpen(false)}
              >
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  health === "ok" && "bg-green-500 pulse-dot",
                  health === "error" && "bg-red-500",
                  health === "loading" && "bg-gray-400"
                )}
              />
              <span
                className={cn(
                  "text-xs font-bold",
                  health === "ok" && "text-green-700 dark:text-green-400",
                  health === "error" && "text-red-600 dark:text-red-400",
                  health === "loading" && "text-gray-500"
                )}
              >
                {health === "ok" ? "System Normal" : health === "error" ? "DB Issue" : "Checking DB"}
              </span>
            </div>
              <div className={cn(
                "pointer-events-none absolute right-0 top-10 z-50 w-56 rounded-lg border border-gray-200/80 bg-white px-3 py-2 text-[11px] text-gray-600 shadow-lg transition dark:border-white/10 dark:bg-mydark dark:text-gray-300",
                healthTipOpen ? "opacity-100" : "opacity-0"
              )}>
                {health === "error"
                  ? (healthError || "Database check failed.")
                  : "Database health status"}
              </div>
            </div>

            <div className="relative hidden md:block">
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-500 cursor-pointer select-none",
                sessionOk === "ok" && "bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800",
                sessionOk === "error" && "bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800",
                sessionOk === "loading" && "bg-gray-100 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700"
              )}
                role="button"
                tabIndex={0}
                onClick={() => setAuthTipOpen((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setAuthTipOpen((v) => !v)
                  }
                }}
                onBlur={() => setAuthTipOpen(false)}
              >
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  sessionOk === "ok" && "bg-blue-500 pulse-dot",
                  sessionOk === "error" && "bg-orange-500",
                  sessionOk === "loading" && "bg-gray-400"
                )}
              />
              <span
                className={cn(
                  "text-xs font-bold",
                  sessionOk === "ok" && "text-blue-700 dark:text-blue-400",
                  sessionOk === "error" && "text-orange-600 dark:text-orange-400",
                  sessionOk === "loading" && "text-gray-500"
                )}
              >
                {sessionOk === "ok" ? "Auth OK" : sessionOk === "error" ? "Auth Error" : "Auth Check"}
              </span>
            </div>
              <div className={cn(
                "pointer-events-none absolute right-0 top-10 z-50 w-56 rounded-lg border border-gray-200/80 bg-white px-3 py-2 text-[11px] text-gray-600 shadow-lg transition dark:border-white/10 dark:bg-mydark dark:text-gray-300",
                authTipOpen ? "opacity-100" : "opacity-0"
              )}>
                {sessionOk === "error"
                  ? (sessionError || "Auth check failed.")
                  : "Authentication status"}
              </div>
            </div>

            <ModeToggle />
            <LogoutButton className="hidden md:inline-flex text-xs font-bold px-3 py-2 rounded-full border border-myamber/30 text-myamber hover:bg-myamber/10 transition-colors" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth relative">
          <div className="mb-4">
            <OperationalAlerts />
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}

