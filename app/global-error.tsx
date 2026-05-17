"use client"

import { AlertTriangle, RefreshCw } from "lucide-react"

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-[#111B27] text-white flex items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-[#FFBF00]">Bal Nova</p>
            <h1 className="mt-2 text-2xl font-black">Application Error</h1>
            <p className="mt-3 text-sm text-gray-300">
              {error.message || "The application could not render this screen."}
            </p>
            <button
              onClick={() => reset()}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[#FFBF00] px-4 py-2 text-sm font-bold text-black"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
