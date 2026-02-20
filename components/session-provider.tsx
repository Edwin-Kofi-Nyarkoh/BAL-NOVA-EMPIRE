// components/session-provider.tsx
"use client"

import { SessionProvider, signOut, useSession } from "next-auth/react"
import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/forgot-password", "/reset-password"]
const SESSION_LOADING_TIMEOUT_MS = 8000
const INACTIVITY_LOGOUT_MS = 6 * 60 * 60 * 1000
const LAST_ACTIVE_KEY = "balnova_last_active_ts"

function SessionRedirectGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const shouldShowExpired =
    status === "unauthenticated" && !PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
  const shouldForceLogoutOnStuck =
    status === "loading" && !PUBLIC_ROUTES.some((route) => pathname.startsWith(route))

  useEffect(() => {
    if (shouldShowExpired) {
      void signOut({ redirect: false })
      const timer = setTimeout(() => {
        router.replace("/")
      }, 1200)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [shouldShowExpired, router])

  useEffect(() => {
    if (!shouldForceLogoutOnStuck) return
    const timer = setTimeout(() => {
      void signOut({ redirect: false })
      router.replace("/")
    }, SESSION_LOADING_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [shouldForceLogoutOnStuck, router])

  useEffect(() => {
    function markActive() {
      localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
    }
    function checkIdle() {
      const last = Number(localStorage.getItem(LAST_ACTIVE_KEY) || 0)
      if (!last) {
        markActive()
        return
      }
      if (Date.now() - last >= INACTIVITY_LOGOUT_MS) {
        void signOut({ redirect: false })
        router.replace("/")
      }
    }

    markActive()
    checkIdle()
    const interval = setInterval(checkIdle, 60000)

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        checkIdle()
      }
    }

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"]
    events.forEach((evt) => window.addEventListener(evt, markActive, { passive: true }))
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      clearInterval(interval)
      events.forEach((evt) => window.removeEventListener(evt, markActive as EventListener))
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [router])

  return (
    <>
      {shouldShowExpired ? (
        <div className="fixed top-4 left-1/2 z-[100] -translate-x-1/2 rounded-full border border-amber-300 bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-800 shadow-lg">
          Session expired. Redirecting to landing page...
        </div>
      ) : null}
      {children}
    </>
  )
}

export function AppSessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={60} refetchOnWindowFocus>
      <SessionRedirectGuard>{children}</SessionRedirectGuard>
    </SessionProvider>
  )
}
