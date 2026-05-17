"use client"

import Link from "next/link"
import { AlertTriangle, Home, RefreshCw } from "lucide-react"

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-mydark text-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-myamber">Bal Nova</p>
        <h1 className="mt-2 text-2xl font-black">Something went wrong</h1>
        <p className="mt-3 text-sm text-gray-300">
          {error.message || "The page hit an unexpected error. You can retry or return home."}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-myamber px-4 py-2 text-sm font-bold text-black"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}
