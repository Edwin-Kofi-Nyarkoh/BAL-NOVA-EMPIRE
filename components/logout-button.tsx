// components/logout-button.tsx
"use client"

import { signOut, useSession } from "next-auth/react"

export function LogoutButton({ className }: { className?: string }) {
  const { status } = useSession()
  if (status !== "authenticated") return null
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className={className}
    >
      Logout
    </button>
  )
}
