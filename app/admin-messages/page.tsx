"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AdminShell } from "@/components/dashboard/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Chat = {
  id: string
  role: string
  text: string
  createdAt: string
}

type ThreadItem = {
  id: string
  status: string
  updatedAt: string
  unreadCount: number
  user?: { id: string; name: string | null; email: string; role: string } | null
  lastMessage?: Chat | null
}

const ROLE_STYLES: Record<string, string> = {
  admin: "bg-blue-500/15 text-blue-600",
  user: "bg-gray-500/15 text-gray-600",
  ai: "bg-purple-500/15 text-purple-600"
}

export default function AdminMessagesPage() {
  const [threads, setThreads] = useState<ThreadItem[]>([])
  const [messages, setMessages] = useState<Chat[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [message, setMessage] = useState("")
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [activeThreadId, setActiveThreadId] = useState<string>("")
  const [backfillStatus, setBackfillStatus] = useState<"idle" | "running" | "done">("idle")
  const [backfillNote, setBackfillNote] = useState("")
  const [showBackfillConfirm, setShowBackfillConfirm] = useState(false)
  const streamRef = useRef<EventSource | null>(null)
  const sinceRef = useRef<string>("")

  async function loadThreads() {
    setStatus("loading")
    setMessage("")
    try {
      const res = await fetch("/api/chats?view=threads")
      if (!res.ok) throw new Error("Unable to load messages")
      const data = await res.json().catch(() => ({}))
      const nextThreads = Array.isArray(data?.threads) ? data.threads : []
      setThreads(nextThreads)
      if (!activeThreadId && nextThreads.length > 0) {
        setActiveThreadId(nextThreads[0].id)
      }
      setStatus("idle")
    } catch (err) {
      setStatus("error")
      setMessage(err instanceof Error ? err.message : "Unable to load messages")
    }
  }

  async function loadThreadMessages(threadId: string) {
    if (!threadId) return
    try {
      const res = await fetch(`/api/chats?threadId=${encodeURIComponent(threadId)}`)
      if (!res.ok) throw new Error("Unable to load messages")
      const data = await res.json().catch(() => ({}))
      const next = Array.isArray(data?.chats) ? data.chats : []
      setMessages(next)
      const last = next[next.length - 1]
      if (last?.createdAt) {
        sinceRef.current = last.createdAt
      }
      await fetch("/api/chats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, markRead: true })
      })
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to load messages")
    }
  }

  useEffect(() => {
    let active = true
    void loadThreads()
    const interval = setInterval(() => {
      if (!active) return
      void loadThreads()
    }, 20000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (activeThreadId) {
      void loadThreadMessages(activeThreadId)
    } else {
      setMessages([])
    }
  }, [activeThreadId])

  useEffect(() => {
    if (!activeThreadId) {
      if (streamRef.current) {
        streamRef.current.close()
        streamRef.current = null
      }
      return
    }

    if (streamRef.current) {
      streamRef.current.close()
      streamRef.current = null
    }

    const since = sinceRef.current || new Date(Date.now() - 60 * 1000).toISOString()
    const es = new EventSource(`/api/chats/stream?threadId=${encodeURIComponent(activeThreadId)}&since=${encodeURIComponent(since)}`)
    streamRef.current = es

    es.addEventListener("chats", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data || "{}")
        const incoming = Array.isArray(payload?.messages) ? payload.messages : []
        if (!incoming.length) return
        const last = incoming[incoming.length - 1]
        if (last?.createdAt) {
          sinceRef.current = last.createdAt
        }
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id))
          const merged = [...prev]
          for (const msg of incoming) {
            if (!seen.has(msg.id)) merged.push(msg)
          }
          return merged
        })
      } catch {
        // ignore
      }
    })

    es.onerror = () => {
      if (streamRef.current) {
        streamRef.current.close()
        streamRef.current = null
      }
      setTimeout(() => {
        if (activeThreadId) {
          const next = new EventSource(`/api/chats/stream?threadId=${encodeURIComponent(activeThreadId)}&since=${encodeURIComponent(sinceRef.current || new Date(Date.now() - 60 * 1000).toISOString())}`)
          streamRef.current = next
        }
      }, 6000)
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.close()
        streamRef.current = null
      }
    }
  }, [activeThreadId])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const grouped = useMemo(() => messages, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || sending || !activeThreadId) return
    setSending(true)
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat: { role: "admin", text, threadId: activeThreadId } })
      })
      if (!res.ok) throw new Error("Unable to send message")
      await loadThreadMessages(activeThreadId)
      await loadThreads()
      setInput("")
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to send message")
    } finally {
      setSending(false)
    }
  }

  async function updateThreadStatus(status: string) {
    if (!activeThreadId) return
    await fetch("/api/chats", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: activeThreadId, status })
    })
    await loadThreads()
  }

  async function runBackfill() {
    setBackfillStatus("running")
    try {
      const res = await fetch("/api/chats/backfill", { method: "POST" })
      if (!res.ok) throw new Error("Backfill failed")
      const data = await res.json().catch(() => ({}))
      setBackfillStatus("done")
      const updated = Number(data?.updated ?? 0)
      const createdThreads = Number(data?.createdThreads ?? 0)
      setBackfillNote(`Backfill complete: ${updated} messages linked - ${createdThreads} threads created.`)
      await loadThreads()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Backfill failed")
      setBackfillStatus("idle")
    }
  }

  const activeThread = threads.find((t) => t.id === activeThreadId)

  return (
    <AdminShell title="Admin Messages" subtitle="Reply to customer messages in real time">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="bg-white dark:bg-mydark lg:col-span-1">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-mynavy dark:text-white">Threads</h3>
                <p className="text-[10px] text-gray-500">Customers & partners</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadThreads}
                  className="text-[10px] font-bold px-2 py-1 rounded-full border border-myamber/40 text-myamber hover:bg-myamber/10 transition-colors"
                >
                  Refresh
                </button>
                <button
                  onClick={() => setShowBackfillConfirm(true)}
                  className="text-[10px] font-bold px-2 py-1 rounded-full border border-blue-500/40 text-blue-600 hover:bg-blue-500/10 transition-colors"
                  disabled={backfillStatus === "running"}
                >
                  {backfillStatus === "running" ? "Backfilling..." : "Backfill"}
                </button>
              </div>
            </div>
            {showBackfillConfirm ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800/40 px-3 py-2 text-[11px] text-blue-700 dark:text-blue-200 space-y-2">
                <p className="font-semibold">Backfill legacy chats into threads?</p>
                <p className="opacity-80">This will link old messages to new conversation threads.</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowBackfillConfirm(false)
                      void runBackfill()
                    }}
                    className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowBackfillConfirm(false)}
                    className="text-[10px] font-bold px-2 py-1 rounded-full border border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-200 dark:hover:bg-blue-900/40"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
            {backfillNote ? (
              <p className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-800/40">
                {backfillNote}
              </p>
            ) : null}
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {threads.length === 0 ? (
                <p className="text-xs text-gray-500">No conversations yet.</p>
              ) : threads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => setActiveThreadId(thread.id)}
                  className={cn(
                    "w-full text-left rounded-xl border px-3 py-2 transition",
                    activeThreadId === thread.id
                      ? "border-myamber bg-myamber/10"
                      : "border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">
                      {thread.user?.name || thread.user?.email || "Unknown user"}
                    </div>
                    {thread.unreadCount > 0 ? (
                      <span className="rounded-full bg-red-500 text-white text-[10px] px-2 py-0.5 font-bold">
                        {thread.unreadCount}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {thread.lastMessage?.text || "No messages yet"}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[9px] text-gray-400">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-full border",
                      thread.status === "resolved"
                        ? "border-emerald-300 text-emerald-600"
                        : "border-amber-300 text-amber-600"
                    )}>
                      {thread.status}
                    </span>
                    <span>{new Date(thread.updatedAt).toLocaleTimeString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-mydark lg:col-span-2">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-mynavy dark:text-white">Conversation Feed</h3>
                <p className="text-xs text-gray-500">Latest customer and admin messages.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => activeThreadId && loadThreadMessages(activeThreadId)}
                  className="text-xs font-bold px-3 py-2 rounded-full border border-myamber/40 text-myamber hover:bg-myamber/10 transition-colors"
                >
                  Refresh
                </button>
                <button
                  onClick={() => updateThreadStatus(activeThread?.status === "resolved" ? "open" : "resolved")}
                  disabled={!activeThreadId}
                  className="text-xs font-bold px-3 py-2 rounded-full border border-emerald-400/40 text-emerald-600 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                >
                  {activeThread?.status === "resolved" ? "Reopen" : "Resolve"}
                </button>
              </div>
            </div>

            <div
              ref={scrollRef}
              className="h-[520px] overflow-y-auto rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 space-y-3"
            >
              {status === "loading" ? (
                <p className="text-sm text-gray-500">Loading messages...</p>
              ) : grouped.length === 0 ? (
                <p className="text-sm text-gray-500">Select a thread to view messages.</p>
              ) : (
                grouped.map((chat) => (
                  <div key={chat.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      <span className={cn("px-2 py-0.5 rounded-full font-bold", ROLE_STYLES[chat.role] || "bg-gray-100 text-gray-500")}>
                        {chat.role.toUpperCase()}
                      </span>
                      <span>{new Date(chat.createdAt).toLocaleString()}</span>
                    </div>
                    <div className={cn(
                      "rounded-xl px-4 py-3 text-sm border",
                      chat.role === "admin"
                        ? "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-700/50 dark:text-blue-100"
                        : "bg-gray-50 border-gray-200 text-gray-800 dark:bg-white/5 dark:border-white/10 dark:text-gray-100"
                    )}>
                      {chat.text}
                    </div>
                  </div>
                ))
              )}
            </div>

            {(status === "error" || message) && (
              <p className="text-xs text-red-500">{message || "Unable to load messages."}</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-mydark">
          <CardContent className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-mynavy dark:text-white">Reply</h3>
              <p className="text-xs text-gray-500">Send an admin response to customers.</p>
            </div>
            <textarea
              className="w-full min-h-[180px] rounded-xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm text-gray-800 dark:text-gray-100"
              placeholder="Write a reply..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending || !activeThreadId}
              className="w-full rounded-full bg-myamber text-black text-sm font-bold py-2 disabled:opacity-60"
            >
              {sending ? "Sending..." : "Send Reply"}
            </button>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  )
}
