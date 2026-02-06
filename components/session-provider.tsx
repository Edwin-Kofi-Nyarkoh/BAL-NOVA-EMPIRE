// components/session-provider.tsx
"use client"

import { SessionProvider, useSession } from "next-auth/react"
import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/forgot-password", "/reset-password"]

function SessionRedirectGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const shouldShowExpired =
    status === "unauthenticated" && !PUBLIC_ROUTES.some((route) => pathname.startsWith(route))

  useEffect(() => {
    if (shouldShowExpired) {
      const timer = setTimeout(() => {
        router.replace("/")
      }, 1200)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [shouldShowExpired, router])

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
    <SessionProvider refetchInterval={0} refetchOnWindowFocus>
      <SessionRedirectGuard>{children}</SessionRedirectGuard>
    </SessionProvider>
  )
}
