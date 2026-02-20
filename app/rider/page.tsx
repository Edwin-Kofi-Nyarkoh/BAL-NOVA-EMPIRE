
// app/rider/page.tsx
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Shield, Zap, MessageCircle, TriangleAlert, Ruler, Copy, X } from "lucide-react"
import { getJSON, requestJSON } from "@/lib/sync"
import { LogoutButton } from "@/components/logout-button"
import { Rajdhani, JetBrains_Mono } from "next/font/google"

const rajdhani = Rajdhani({ subsets: ["latin"], weight: ["500", "600", "700"] })
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "800"] })

type RiderState = {
  id: string
  status: string
  currentSector: string
  currentVol: number
  pendingCash: number
  xp: number
  streak: number
  reputation: number
  rankTitle: string
  isHoldActive: boolean
  lastKnownLocation?: string | null
  activeTaskId?: string | null
}

type RiderTask = {
  id: string
  type: "pickup" | "drop" | string
  loc: string
  note?: string | null
  status: "pending" | "active" | "done" | string
  revenue: number
  sequence: number
}

const SECTOR_PROBABILITIES: Record<string, number> = {
  SPINTEX_PRIME: 0.92,
  AIRPORT_CITY: 0.78,
  EAST_LEGON: 0.84,
  CANTONMENTS: 0.88
}

export default function RiderPage() {
  const [state, setState] = useState<RiderState | null>(null)
  const [tasks, setTasks] = useState<RiderTask[]>([])
  const [actionOpen, setActionOpen] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [qcChecked, setQcChecked] = useState(false)
  const [sliderProgress, setSliderProgress] = useState(0)
  const [sliderEnabled, setSliderEnabled] = useState(false)
  const [sliderX, setSliderX] = useState(0)
  const [sliderMaxX, setSliderMaxX] = useState(0)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiText, setAiText] = useState("")
  const [generalModalOpen, setGeneralModalOpen] = useState(false)
  const [generalModalTitle, setGeneralModalTitle] = useState("")
  const [generalModalType, setGeneralModalType] = useState<"comms" | "report" | null>(null)
  const [reportOptions, setReportOptions] = useState<string[]>([])
  const [alertModal, setAlertModal] = useState<string | null>(null)
  const [vacuumOpen, setVacuumOpen] = useState(false)
  const [endShiftOpen, setEndShiftOpen] = useState(false)
  const [loadingAI, setLoadingAI] = useState(false)
  const [chatMessages, setChatMessages] = useState<{ id: string; role: string; text: string; createdAt: string }[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [chatSending, setChatSending] = useState(false)
  const [geoStatus, setGeoStatus] = useState<"idle" | "watching" | "denied" | "unsupported">("idle")
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null)
  const [lastGeoError, setLastGeoError] = useState("")
  const [isVisible, setIsVisible] = useState(true)
  const [togglingOnline, setTogglingOnline] = useState(false)

  const trackRef = useRef<HTMLDivElement | null>(null)
  const knobRef = useRef<HTMLDivElement | null>(null)
  const wakeLockRef = useRef<any>(null)
  const geoWatchRef = useRef<number | null>(null)
  const lastLocationSentRef = useRef(0)
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null)

  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => a.sequence - b.sequence),
    [tasks]
  )
  const activeTask = useMemo(() => {
    const active = activeTaskId
      ? sortedTasks.find((t) => t.id === activeTaskId)
      : sortedTasks.find((t) => t.status !== "done")
    return active || null
  }, [activeTaskId, sortedTasks])

  useEffect(() => {
    void initSystem()
    const interval = setInterval(runBrainDiagnostics, 5000)
    const refresh = setInterval(() => void refreshDashboard(), 20000)
    const onVis = () => setIsVisible(document.visibilityState === "visible")
    document.addEventListener("visibilitychange", onVis)
    startGeoWatch()
    return () => {
      clearInterval(interval)
      clearInterval(refresh)
      document.removeEventListener("visibilitychange", onVis)
      stopGeoWatch()
    }
  }, [])

  useEffect(() => {
    if (!activeTask) {
      setActionOpen(false)
      setSliderProgress(0)
      setSliderEnabled(false)
      setSliderX(0)
      setQcChecked(false)
      return
    }
    setSliderProgress(0)
    setSliderEnabled(false)
    setSliderX(0)
    setQcChecked(false)
    const timer = setTimeout(() => {
      if (activeTask.type !== "pickup") {
        setSliderEnabled(true)
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [activeTask?.id])
  async function initSystem() {
    await refreshDashboard()
    requestWakeLock()
    speak("V12 Flight Deck Online. Neural uplink ready.")
  }

  async function refreshDashboard() {
    if (!isVisible) return
    const data = await getJSON<{ state?: RiderState; tasks?: RiderTask[] }>(
      "/api/rider/dashboard",
      {}
    )
    if (data.state) setState(data.state)
    if (Array.isArray(data.tasks)) setTasks(data.tasks)
    const nextActive = data.state?.activeTaskId || pickFirstTaskId(data.tasks || [])
    setActiveTaskId(nextActive)
  }

  function pickFirstTaskId(list: RiderTask[]) {
    return list.find((t) => t.status !== "done")?.id || null
  }

  async function openTask(taskId: string) {
    setActiveTaskId(taskId)
    setActionOpen(true)
    setQcChecked(false)
    setSliderProgress(0)
    setSliderEnabled(false)
    setSliderX(0)
    await requestJSON(`/api/rider/tasks/${taskId}`, { action: "activate" }, "PATCH", {})
    setTimeout(() => {
      const t = sortedTasks.find((x) => x.id === taskId)
      if (t && t.type !== "pickup") {
        setSliderEnabled(true)
      }
    }, 1000)
  }

  async function completeTask() {
    if (!activeTask) return
    const data = await requestJSON<{
      state?: RiderState
      tasks?: RiderTask[]
    }>(`/api/rider/tasks/${activeTask.id}`, { action: "complete" }, "PATCH", {})
    if (data?.state) setState(data.state)
    if (Array.isArray(data?.tasks)) setTasks(data.tasks)
    setActiveTaskId(data?.state?.activeTaskId || pickFirstTaskId(data?.tasks || []))
    setActionOpen(false)
    setSliderProgress(0)
    setSliderEnabled(false)
    setSliderX(0)
    setQcChecked(false)
    vibrateDevice([100, 50])
    speak(activeTask.type === "pickup" ? "Cargo secured." : "Delivery confirmed.")
  }

  async function generateNeuralBrief() {
    if (loadingAI) return
    setLoadingAI(true)
    setAiModalOpen(true)
    setAiText("Encrypting channel... generating response...")
    const data = await requestJSON<{ text?: string }>("/api/rider/ai", { type: "brief" }, "POST", {})
    setAiText(data?.text || "Signal lost. Check AI connectivity.")
    setLoadingAI(false)
    vibrateDevice([50, 50, 100])
    speak("Incoming neural transmission.")
  }

  async function generateTacticalComms(scenario: string) {
    setGeneralModalOpen(false)
    setGeneralModalType(null)
    setAiModalOpen(true)
    setAiText("Encrypting message channel... generating response...")
    const data = await requestJSON<{ text?: string }>(
      "/api/rider/ai",
      { type: "comms", scenario },
      "POST",
      {}
    )
    setAiText(data?.text || "Signal lost. Check AI connectivity.")
  }

  async function loadChats() {
    setChatLoading(true)
    try {
      const data = await getJSON<{ chats?: { id: string; role: string; text: string; createdAt: string }[] }>(
        "/api/chats",
        {}
      )
      setChatMessages(Array.isArray(data.chats) ? data.chats : [])
    } catch {
      setChatMessages([])
    } finally {
      setChatLoading(false)
    }
  }

  async function sendChat() {
    const text = chatInput.trim()
    if (!text) return
    setChatSending(true)
    try {
      const data = await requestJSON<{ chats?: { id: string; role: string; text: string; createdAt: string }[] }>(
        "/api/chats",
        { chat: { role: "user", text } },
        "POST",
        {}
      )
      setChatInput("")
      setChatMessages(Array.isArray(data?.chats) ? data.chats : [])
    } catch {
      // ignore
    } finally {
      setChatSending(false)
    }
  }

  async function sendReport(category: string) {
    await requestJSON("/api/rider/report", { taskId: activeTask?.id, category }, "POST", {})
    setGeneralModalOpen(false)
    setGeneralModalType(null)
    setAlertModal(`REPORT SENT: ${category.toUpperCase()}`)
  }

  function openCommsModal() {
    setGeneralModalTitle("TACTICAL COMMS")
    void loadChats()
    setGeneralModalType("comms")
    setGeneralModalOpen(true)
  }

  function openReportModal(type: "fail" | "mismatch") {
    const options =
      type === "fail"
        ? ["Customer Unavailable", "Location Inaccessible", "Vehicle Breakdown", "Refused Pickup"]
        : ["Package Too Large", "Weight Limit Exceeded", "Requires Car", "Damaged Item"]
    setGeneralModalTitle(type === "fail" ? "REPORT FAILURE" : "SIZE MISMATCH")
    setReportOptions(options)
    setGeneralModalType("report")
    setGeneralModalOpen(true)
  }
  function runBrainDiagnostics() {
    if (!isVisible) return
    if (!state) return
    const currentProb = SECTOR_PROBABILITIES[state.currentSector] || 0
    const activeCount = tasks.filter((t) => t.status !== "done").length
    if (state.status === "Idle" && currentProb > 0.85 && activeCount === 0 && !state.isHoldActive) {
      void requestJSON("/api/rider/state", { isHoldActive: true }, "PATCH", {})
      setState((prev) => (prev ? { ...prev, isHoldActive: true } : prev))
      vibrateDevice([100, 50, 100])
    }
  }

  function endShiftPrompt() {
    const activeCount = tasks.filter((t) => t.status !== "done").length
    if (activeCount > 0) {
      setAlertModal("ERROR: COMPLETE TASKS FIRST")
      return
    }
    setEndShiftOpen(true)
  }

  async function endShift() {
    await requestJSON("/api/rider/state", { action: "end_shift" }, "PATCH", {})
    setEndShiftOpen(false)
    await refreshDashboard()
    setAlertModal("SHIFT TERMINATED")
  }

  async function acceptVacuum() {
    setVacuumOpen(false)
    const data = await requestJSON<{ error?: string; tasks?: RiderTask[] }>(
      "/api/rider/vacuum",
      {},
      "POST",
      {}
    )
    if (data?.error) {
      setAlertModal(data.error)
      return
    }
    await refreshDashboard()
    const count = Array.isArray(data?.tasks) ? data.tasks.length : 0
    setAlertModal(`ROUTE UPDATED: ${count} NODES ADDED`)
  }

  function vibrateDevice(pattern: number | number[]) {
    if (navigator.vibrate) navigator.vibrate(pattern)
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return
    const synth = window.speechSynthesis
    synth.cancel()
    const msg = new SpeechSynthesisUtterance(text)
    msg.rate = 1.1
    msg.pitch = 0.9
    synth.speak(msg)
  }

  async function requestWakeLock() {
    if (!("wakeLock" in navigator)) return
    try {
      wakeLockRef.current = await (navigator as any).wakeLock.request("screen")
    } catch {
      // ignore
    }
  }

  async function toggleOnline() {
    if (togglingOnline) return
    setTogglingOnline(true)
    try {
      if (state?.status === "Offline") {
        const data = await requestJSON<{ state?: RiderState }>(
          "/api/rider/state",
          { action: "go_online" },
          "PATCH",
          {}
        )
        if (data?.state) setState(data.state)
      } else {
        const data = await requestJSON<{ state?: RiderState }>(
          "/api/rider/state",
          { action: "go_offline" },
          "PATCH",
          {}
        )
        if (data?.state) setState(data.state)
      }
    } finally {
      setTogglingOnline(false)
    }
  }

  function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const toRad = (v: number) => (v * Math.PI) / 180
    const R = 6371000
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const lat1 = toRad(a.lat)
    const lat2 = toRad(b.lat)
    const h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    return 2 * R * Math.asin(Math.sqrt(h))
  }

  function startGeoWatch() {
    if (!("geolocation" in navigator)) {
      setGeoStatus("unsupported")
      return
    }
    setGeoStatus("watching")
    setLastGeoError("")
    geoWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const payload = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: typeof pos.coords.heading === "number" ? pos.coords.heading : null
        }
        const nextCoords = { lat: payload.lat, lng: payload.lng, accuracy: payload.accuracy }
        const prev = lastCoordsRef.current
        setCoords(nextCoords)
        lastCoordsRef.current = { lat: nextCoords.lat, lng: nextCoords.lng }
        const now = Date.now()
        const movedEnough = prev ? distanceMeters(prev, nextCoords) > 8 : true
        if (movedEnough && now - lastLocationSentRef.current > 10000) {
          lastLocationSentRef.current = now
          void requestJSON("/api/rider/location", payload, "POST", {})
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus("denied")
          setLastGeoError("Location permission denied.")
        } else {
          setLastGeoError("Unable to read location.")
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )
  }

  function stopGeoWatch() {
    if (geoWatchRef.current !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(geoWatchRef.current)
      geoWatchRef.current = null
    }
  }

  function onSliderPointerDown(e: React.PointerEvent) {
    if (!sliderEnabled) return
    const knob = knobRef.current
    const track = trackRef.current
    if (track && knob) {
      const rect = track.getBoundingClientRect()
      const knobRect = knob.getBoundingClientRect()
      setSliderMaxX(rect.width - knobRect.width - 12)
    }
    if (!knob) return
    knob.setPointerCapture(e.pointerId)
  }

  function onSliderPointerMove(e: React.PointerEvent) {
    if (!sliderEnabled) return
    const track = trackRef.current
    const knob = knobRef.current
    if (!track || !knob || !(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return
    const rect = track.getBoundingClientRect()
    const knobRect = knob.getBoundingClientRect()
    const maxX = sliderMaxX || rect.width - knobRect.width - 12
    const x = Math.min(Math.max(0, e.clientX - rect.left - 6), maxX)
    setSliderProgress(maxX > 0 ? x / maxX : 0)
    setSliderX(x)
  }

  function onSliderPointerUp(e: React.PointerEvent) {
    if (!sliderEnabled) return
    const knob = knobRef.current
    if (!knob) return
    knob.releasePointerCapture(e.pointerId)
    if (sliderProgress > 0.85) {
      setSliderProgress(1)
      setSliderX(sliderMaxX)
      void completeTask()
    } else {
      setSliderProgress(0)
      setSliderX(0)
      vibrateDevice(50)
    }
  }

  const volumePct = Math.min(100, state?.currentVol || 0)
  const pendingCash = state?.pendingCash || 0
  const activeCount = tasks.filter((t) => t.status !== "done").length
  const displayTasks = sortedTasks.filter((t) => t.status !== "done")
  const showRadar = activeCount === 0

  return (
    <div className={`${rajdhani.className} ${jetbrains.className} h-screen bg-[#050b14] text-slate-200 overflow-hidden`}>
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(rgba(0,240,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.03)_1px,transparent_1px)] bg-[length:40px_40px]" />

      <header
        className={`fixed top-0 left-0 right-0 z-30 px-4 py-3 pt-safe hud-glass transition-colors duration-300 ${
          state?.isHoldActive ? "border-b-2 border-amber-400/70" : ""
        }`}
      >
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <div className="absolute inset-0 border border-cyan-400/30 rounded-full border-dashed animate-spin-slow" />
              <div className="absolute inset-1 border border-cyan-400/50 rounded-full border-t-transparent border-l-transparent animate-spin-reverse" />
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[10px] text-cyan-200 relative z-10">
                {state?.rankTitle || "NOVICE"}
              </div>
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-neon-blue z-20 border border-black" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-widest text-white uppercase">
                {state?.lastKnownLocation || "Empire Rider"}{" "}
                <span className="text-amber-400 text-[9px]">V.12</span>
              </h1>
              <div className="flex items-center gap-2 text-[9px] font-mono text-gray-400">
                <span>{state?.rankTitle || "NOVICE"}</span>
                <span className="text-gray-600">{"///"}</span>
                <span>REP {state?.reputation ?? 100}%</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[8px] text-gray-500 uppercase font-mono tracking-wider">Session Yield</div>
            <div className="text-xl font-mono font-black text-amber-400 leading-none">
              GHS {pendingCash.toFixed(2)}
            </div>
            <div className="mt-1 text-[9px] text-gray-500 font-mono">
              GPS:{" "}
              {geoStatus === "watching"
                ? coords
                  ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                  : "Locking..."
                : geoStatus === "denied"
                  ? "Denied"
                  : geoStatus === "unsupported"
                    ? "Unavailable"
                    : "Idle"}
              {lastGeoError ? ` · ${lastGeoError}` : ""}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 relative flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 36 36">
              <path
                className="text-slate-800"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="text-cyan-300 gauge-circle"
                strokeDasharray="100, 100"
                strokeDashoffset={100 - volumePct}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-[8px] font-bold text-white">{volumePct}%</div>
          </div>

          <div className="flex-1 flex justify-end gap-2">
            <button
              onClick={generateNeuralBrief}
              className="h-8 px-3 rounded bg-slate-900 border border-purple-500/50 text-purple-300 text-xs font-bold hover:bg-purple-500 hover:text-black hover:shadow-neon-purple transition-all flex items-center gap-1"
            >
              <Zap className="w-3 h-3" /> UPLINK
            </button>
            <button
              onClick={toggleOnline}
              disabled={togglingOnline}
              className={`h-8 px-3 rounded text-xs font-bold border transition-all ${
                state?.status === "Offline"
                  ? "border-emerald-400/50 text-emerald-300 hover:bg-emerald-400 hover:text-black"
                  : "border-rose-400/50 text-rose-300 hover:bg-rose-400 hover:text-black"
              }`}
            >
              {togglingOnline ? "..." : state?.status === "Offline" ? "GO ONLINE" : "GO OFFLINE"}
            </button>
            <button
              onClick={() => setVacuumOpen(true)}
              className="h-8 px-3 rounded bg-slate-800 border border-slate-700 text-amber-300 text-xs font-bold hover:bg-amber-400 hover:text-black transition-all"
            >
              <Shield className="w-3 h-3 mr-1 inline-block" /> TEST
            </button>
            <button
              onClick={endShiftPrompt}
              className="h-8 px-3 rounded bg-slate-800 border border-slate-700 text-gray-400 text-xs font-bold hover:text-white hover:border-white transition-all"
            >
              END
            </button>
            <LogoutButton className="h-8 px-3 rounded border border-amber-400/40 text-amber-300 text-xs font-bold hover:bg-amber-400 hover:text-black transition-all" />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto relative pt-36 pb-32 px-5 no-scrollbar">
        {showRadar ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-20">
            <div className="relative w-64 h-64 border border-cyan-400/10 rounded-full flex items-center justify-center">
              <div className="absolute inset-0 border border-t-transparent border-cyan-400/30 rounded-full animate-spin-slow" />
              <div className="absolute inset-4 border border-b-transparent border-amber-400/20 rounded-full animate-spin-reverse" />
              <div className="text-4xl text-cyan-300/50 animate-pulse-fast">SCAN</div>
            </div>
            <div className="mt-6 text-center">
              <h2 className="text-2xl font-black text-white tracking-[0.2em] font-mono">SCANNING</h2>
              <p className="text-xs text-cyan-300 font-mono mt-1">
                SECTOR: {state?.currentSector || "SPINTEX_PRIME"}
              </p>
              <div className="mt-4 text-[10px] text-gray-500">WAITING FOR DISPATCH UPLINK...</div>
              <button
                onClick={() => setVacuumOpen(true)}
                className="mt-8 text-[9px] bg-slate-900 border border-cyan-400/30 px-3 py-2 rounded text-cyan-300 hover:bg-cyan-400 hover:text-black transition-colors"
              >
                [DEBUG: FORCE DISPATCH]
              </button>
            </div>
          </div>
        ) : (
          <div className="relative pl-2 min-h-full pb-20">
            <div className="timeline-line" />
            <div className="space-y-8 pt-4">
              {displayTasks.map((task, i) => {
                const firstActiveIndex = displayTasks.findIndex((x) => x.status !== "done")
                const isActive = i === firstActiveIndex
                return (
                  <div
                    key={task.id}
                    className={`stop-node ${isActive ? "active" : "future"} relative pl-8 pb-4`}
                  >
                    <div className="node-dot absolute left-0 top-6 w-3 h-3 rounded-full border-2 bg-black border-gray-600 transition-all duration-500" />
                    <button
                      onClick={() => openTask(task.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        isActive
                          ? "bg-slate-800 border-amber-400 active-task-glow cursor-pointer"
                          : "bg-slate-950 border-slate-800 opacity-60"
                      }`}
                    >
                      <div className="flex justify-between">
                        <h3 className="font-bold text-white uppercase text-sm tracking-tighter">{task.loc}</h3>
                        <span className={`text-[8px] font-mono ${isActive ? "text-amber-300" : "text-gray-600"}`}>
                          {task.type.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-mono mt-1 italic">{task.note}</p>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 transform ${
          actionOpen ? "translate-y-0" : "translate-y-[120%]"
        } transition-transform duration-300 ease-out`}
      >
        <div className="mx-2 mb-2 bg-[#13131f] border border-cyan-400/30 rounded-2xl p-5 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] relative overflow-hidden">
          <div
            className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-gray-700 rounded-full cursor-pointer"
            onClick={() => setActionOpen(false)}
          />

          <div className="flex justify-between items-start mb-6 mt-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-[9px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-widest font-mono ${
                    activeTask?.type === "pickup" ? "bg-amber-400 text-black" : "bg-cyan-400 text-black"
                  }`}
                >
                  {activeTask?.type?.toUpperCase() || "TASK"}
                </span>
                <span className="text-[9px] font-mono text-gray-500">
                  ID: <span className="text-white">#{activeTask?.id?.slice(-4) || "0000"}</span>
                </span>
              </div>
              <h2 className="text-xl font-bold text-white leading-none font-sans uppercase">
                {activeTask?.loc || "Location"}
              </h2>
              <p className="text-xs text-gray-400 mt-1 font-mono border-l-2 border-slate-800 pl-2">
                {activeTask?.note || "Details unavailable."}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xl font-mono font-black text-amber-400">+50</div>
              <div className="text-[8px] text-gray-500 uppercase tracking-widest">XP</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-5">
            <button
              onClick={openCommsModal}
              className="col-span-2 bg-slate-900 border border-slate-700 hover:border-purple-400 text-gray-300 hover:text-purple-300 p-3 rounded-lg flex flex-col items-center justify-center transition-all"
            >
              <MessageCircle className="w-5 h-5 mb-1" />
              <span className="text-[8px] font-bold uppercase tracking-wider">Comms</span>
            </button>
            <button
              onClick={() => openReportModal("fail")}
              className="col-span-1 bg-slate-900 border border-slate-700 hover:border-rose-400 text-gray-300 hover:text-rose-300 p-3 rounded-lg flex flex-col items-center justify-center transition-all"
            >
              <TriangleAlert className="w-5 h-5 mb-1" />
              <span className="text-[8px] font-bold uppercase">Fail</span>
            </button>
            <button
              onClick={() => openReportModal("mismatch")}
              className="col-span-1 bg-slate-900 border border-slate-700 hover:border-amber-400 text-gray-300 hover:text-amber-300 p-3 rounded-lg flex flex-col items-center justify-center transition-all"
            >
              <Ruler className="w-5 h-5 mb-1" />
              <span className="text-[8px] font-bold uppercase">Size</span>
            </button>
          </div>

          <div className="space-y-3">
            {activeTask?.type === "pickup" ? (
              <label className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-700 rounded-lg cursor-pointer hover:border-cyan-400 transition-colors">
                <input
                  type="checkbox"
                  checked={qcChecked}
                  onChange={(e) => {
                    setQcChecked(e.target.checked)
                    if (e.target.checked) setSliderEnabled(true)
                  }}
                  className="w-5 h-5 accent-cyan-400 rounded bg-gray-800 border-gray-600"
                />
                <div className="text-xs text-gray-300 font-bold uppercase">Visual QC Verified</div>
              </label>
            ) : null}

            <div
              ref={trackRef}
              className={`slider-track ${sliderEnabled ? "" : "opacity-50 pointer-events-none"}`}
            >
              <div
                ref={knobRef}
                className="slider-knob absolute top-1.5 left-1.5 bottom-1.5 w-14 rounded-lg cursor-grab active:cursor-grabbing z-20"
                style={{ transform: `translateX(${sliderX}px)` }}
                onPointerDown={onSliderPointerDown}
                onPointerMove={onSliderPointerMove}
                onPointerUp={onSliderPointerUp}
              >
                <span className="text-lg">{">>"}</span>
              </div>
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <span className="text-xs font-black text-white/30 uppercase tracking-[0.2em] font-mono">ENGAGE</span>
              </div>
              <div
                className="absolute top-0 bottom-0 left-0 bg-amber-400/20 z-0"
                style={{ width: `${Math.min(100, sliderProgress * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {vacuumOpen ? (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-950 border-2 border-amber-400 rounded-3xl p-8 text-center shadow-neon-amber relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-2 bg-[repeating-linear-gradient(45deg,#ffbf00,#ffbf00_10px,#000_10px,#000_20px)]" />
            <div className="text-5xl text-amber-400 mb-6 animate-pulse">ALERT</div>
            <h2 className="text-3xl font-black text-white italic mb-1 uppercase tracking-tighter">Vacuum Offer</h2>
            <p className="text-gray-400 text-xs mb-8 font-mono border-y border-gray-800 py-2">
              PRIORITY INTERCEPT DETECTED
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setVacuumOpen(false)}
                className="py-4 bg-gray-900 border border-gray-700 text-gray-400 font-bold text-xs uppercase hover:text-white transition-colors"
              >
                Ignore
              </button>
              <button
                onClick={acceptVacuum}
                className="py-4 bg-amber-400 text-black font-black text-xs uppercase hover:bg-white shadow-neon-amber transition-colors"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {aiModalOpen ? (
        <div className="fixed inset-0 z-[120] bg-black/95 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="w-full max-w-sm bg-[#13131f] border border-purple-500/50 rounded-xl p-6 shadow-neon-purple relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-purple-500 animate-pulse" />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-purple-400">*</span>
                <h3 className="text-sm font-bold text-white uppercase tracking-widest font-mono">Neural Uplink</h3>
              </div>
              <button
                onClick={() => setAiModalOpen(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close neural uplink"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-gray-300 font-mono leading-relaxed mb-6 border-l-2 border-purple-500 pl-3 min-h-[60px]">
              {aiText}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setAiModalOpen(false)}
                className="flex-1 py-2 bg-gray-800 text-gray-400 font-bold uppercase text-[10px] rounded hover:bg-gray-700"
              >
                Dismiss
              </button>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(aiText)
                }}
                className="flex-1 py-2 bg-purple-500/20 text-purple-300 border border-purple-500/50 font-bold uppercase text-[10px] rounded hover:bg-purple-500 hover:text-black flex items-center justify-center gap-2"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {generalModalOpen ? (
        <div className="fixed inset-0 z-[110] bg-black/90 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="w-full max-w-sm bg-[#0f172a] border border-slate-700 rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest font-mono">
                {generalModalTitle}
              </h3>
              <button
                onClick={() => {
                  setGeneralModalOpen(false)
                  setGeneralModalType(null)
                }}
                className="text-gray-400 hover:text-white"
                aria-label="Close modal"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {generalModalType === "comms" ? (
              <div className="space-y-2">
                <div className="text-[10px] text-cyan-400 font-mono uppercase tracking-wider">AI Generator</div>
                <button
                  onClick={() => generateTacticalComms("Delayed by 10 mins due to grid traffic")}
                  className="w-full text-left p-3 bg-black border border-cyan-500/40 rounded text-xs text-cyan-200 hover:border-cyan-300"
                >
                  Delayed (Traffic)
                </button>
                <button
                  onClick={() => generateTacticalComms("Arrived at location, cannot find entrance")}
                  className="w-full text-left p-3 bg-black border border-cyan-500/40 rounded text-xs text-cyan-200 hover:border-cyan-300"
                >
                  Arrival (Lost)
                </button>
                <div className="border-t border-slate-800 my-3" />
                <button
                  onClick={() => sendReport("standard_sos")}
                  className="w-full text-left p-3 bg-black border border-slate-700 rounded text-xs text-slate-400"
                >
                  Standard SOS
                </button>
                <div className="border-t border-slate-800 my-3" />
                <div className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Live Comms</div>
                <div className="max-h-40 overflow-y-auto space-y-2 text-xs text-gray-300">
                  {chatLoading ? (
                    <div className="text-gray-500">Loading chats...</div>
                  ) : chatMessages.length === 0 ? (
                    <div className="text-gray-500">No messages yet.</div>
                  ) : (
                    chatMessages.map((m) => (
                      <div
                        key={m.id}
                        className={`rounded-lg px-3 py-2 ${m.role === "admin" ? "bg-purple-500/10" : "bg-slate-900"}`}
                      >
                        <div className="text-[10px] text-gray-500">{m.role.toUpperCase()}</div>
                        <div>{m.text}</div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 rounded-lg border border-slate-700 bg-black px-3 py-2 text-xs text-gray-200"
                  />
                  <button
                    onClick={sendChat}
                    disabled={chatSending}
                    className="rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-3 py-2 text-xs font-bold disabled:opacity-60"
                  >
                    {chatSending ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            ) : null}
            {generalModalType === "report" ? (
              <div className="space-y-2">
                {reportOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => sendReport(opt)}
                    className="w-full text-left p-3 bg-black border border-slate-700 rounded text-xs text-slate-300 hover:border-amber-400"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {alertModal ? (
        <div className="fixed inset-0 z-[130] bg-black/90 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-[#0f172a] border border-amber-400/40 rounded-xl p-6 text-center max-w-sm w-full">
            <div className="text-sm font-mono text-amber-300 mb-4">{alertModal}</div>
            <button
              onClick={() => setAlertModal(null)}
              className="w-full py-2 bg-amber-400 text-black font-bold text-xs uppercase rounded"
            >
              Ok
            </button>
          </div>
        </div>
      ) : null}

      {endShiftOpen ? (
        <div className="fixed inset-0 z-[140] bg-black/90 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-[#0f172a] border border-rose-400/40 rounded-xl p-6 text-center max-w-sm w-full">
            <div className="text-sm font-mono text-rose-300 mb-4">TERMINATE UPLINK?</div>
            <div className="flex gap-2">
              <button
                onClick={() => setEndShiftOpen(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 font-bold text-xs uppercase rounded"
              >
                Cancel
              </button>
              <button
                onClick={endShift}
                className="flex-1 py-2 bg-rose-400 text-black font-bold text-xs uppercase rounded"
              >
                Terminate
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  )
}
