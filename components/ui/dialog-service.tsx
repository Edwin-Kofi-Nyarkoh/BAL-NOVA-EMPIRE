// components/ui/dialog-service.tsx
"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { cn } from "@/lib/utils"

type DialogType = "alert" | "confirm" | "prompt"

type DialogState = {
  type: DialogType
  message: string
  placeholder?: string
  defaultValue?: string
  resolve: (value: any) => void
}

type DialogApi = {
  alert: (message: string) => Promise<void>
  confirm: (message: string) => Promise<boolean>
  prompt: (message: string, options?: { placeholder?: string; defaultValue?: string }) => Promise<string | null>
}

const DialogContext = createContext<DialogApi | null>(null)

export function useDialog() {
  const ctx = useContext(DialogContext)
  if (!ctx) {
    throw new Error("useDialog must be used within DialogProvider")
  }
  return ctx
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [inputValue, setInputValue] = useState("")

  const close = useCallback((value: any) => {
    if (dialog) dialog.resolve(value)
    setDialog(null)
    setInputValue("")
  }, [dialog])

  const api = useMemo<DialogApi>(() => ({
    alert: (message) =>
      new Promise<void>((resolve) => {
        setDialog({ type: "alert", message, resolve })
      }),
    confirm: (message) =>
      new Promise<boolean>((resolve) => {
        setDialog({ type: "confirm", message, resolve })
      }),
    prompt: (message, options) =>
      new Promise<string | null>((resolve) => {
        setInputValue(options?.defaultValue || "")
        setDialog({ type: "prompt", message, placeholder: options?.placeholder, defaultValue: options?.defaultValue, resolve })
      })
  }), [])

  return (
    <DialogContext.Provider value={api}>
      {children}
      {dialog ? (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-gray-100 dark:border-gray-800">
            <h3 className="font-bold text-lg dark:text-white mb-2">
              {dialog.type === "alert" ? "Notice" : dialog.type === "confirm" ? "Confirm" : "Input"}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">{dialog.message}</p>

            {dialog.type === "prompt" ? (
              <input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={dialog.placeholder}
                className="w-full mt-4 p-3 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                autoFocus
              />
            ) : null}

            <div className={cn("mt-5 flex items-center justify-end gap-2", dialog.type === "alert" && "justify-end")}>
              {dialog.type !== "alert" ? (
                <button
                  onClick={() => close(dialog.type === "confirm" ? false : null)}
                  className="px-4 py-2 rounded-lg text-sm font-bold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                >
                  Cancel
                </button>
              ) : null}
              <button
                onClick={() => {
                  if (dialog.type === "prompt") {
                    close(inputValue)
                  } else if (dialog.type === "confirm") {
                    close(true)
                  } else {
                    close(undefined)
                  }
                }}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-mynavy text-white"
              >
                {dialog.type === "prompt" ? "Continue" : "OK"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DialogContext.Provider>
  )
}
