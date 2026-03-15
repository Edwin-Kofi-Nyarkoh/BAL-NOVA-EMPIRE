"use client"

import { useEffect } from "react"

declare global {
  interface Window {
    __bal_fetch_patched__?: boolean
  }
}

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "")
const ENABLE_DIRECT_CLIENT_GATEWAY = process.env.NEXT_PUBLIC_ENABLE_CLIENT_GATEWAY_PROXY === "true"

function toAbsoluteApiUrl(input: RequestInfo | URL) {
  if (!API_BASE) return null
  if (typeof input === "string" && input.startsWith("/api/auth/")) {
    return null
  }
  if (typeof input === "string" && input.startsWith("/api/")) {
    return `${API_BASE}${input}`
  }
  if (input instanceof URL && input.pathname.startsWith("/api/")) {
    if (input.pathname.startsWith("/api/auth/")) return null
    return `${API_BASE}${input.pathname}${input.search}`
  }
  if (input instanceof Request) {
    const url = new URL(input.url, window.location.origin)
    if (url.pathname.startsWith("/api/")) {
      if (url.pathname.startsWith("/api/auth/")) return null
      return `${API_BASE}${url.pathname}${url.search}`
    }
  }
  return null
}

export function ApiProxyProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!API_BASE || !ENABLE_DIRECT_CLIENT_GATEWAY) return
    if (window.__bal_fetch_patched__) return

    const nativeFetch = window.fetch.bind(window)
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const absolute = toAbsoluteApiUrl(input)
      if (!absolute) return nativeFetch(input, init)
      if (input instanceof Request) {
        const forwarded = new Request(absolute, input)
        return nativeFetch(forwarded, init)
      }
      return nativeFetch(absolute, init)
    }) as typeof window.fetch

    window.__bal_fetch_patched__ = true
  }, [])

  return <>{children}</>
}
