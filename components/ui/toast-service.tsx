// components/ui/toast-service.tsx
"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { cn } from "@/lib/utils"

type ToastTone = "success" | "error" | "warning" | "info"

type Toast = {
  id: string
  message: string
  tone: ToastTone
}

type ToastApi = {
  push: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((message: string, tone: ToastTone = "success") => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts((prev) => [...prev, { id, message, tone }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3200)
  }, [])

  const api = useMemo<ToastApi>(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-5 right-5 z-[150] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "px-4 py-3 rounded-lg shadow-lg text-white text-xs font-bold tracking-wide",
              toast.tone === "success" && "bg-mynavy",
              toast.tone === "error" && "bg-red-600",
              toast.tone === "warning" && "bg-amber-500",
              toast.tone === "info" && "bg-blue-600"
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
