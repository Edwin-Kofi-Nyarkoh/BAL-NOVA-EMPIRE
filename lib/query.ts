"use client"

import { QueryClient, useQuery } from "@tanstack/react-query"

export type LedgerEntry = {
  id: string
  type: string
  amount: number
  status: string
  note?: string | null
  createdAt: string
  userId: string
}

export type OrderRow = {
  id: string
  userId?: string | null
  item: string
  price: number
  status: string
  createdAt: string
  origin?: string | null
}

export type UserRow = {
  id: string
  name: string | null
  email: string
  role: string
  createdAt: string
}

export type ProRow = {
  id: string
  userId: string
  summary: string
  teamCount: number
  createdAt: string
}

export type AuditLog = {
  id: string
  actorEmail?: string | null
  action: string
  entityType: string
  entityId?: string | null
  createdAt: string
}

export type Analytics = {
  totals: {
    inventoryCount: number
    lowInventoryCount: number
    ordersCount: number
    chatsCount: number
    usersCount: number
    adminsCount: number
    revenue: number
  }
  last24h: {
    orders: number
    chats: number
    newUsers: number
  }
}

export type TrendSeries = {
  date: string
  orders: number
  revenue: number
}

export type RateCard = {
  fx?: number | null
  air?: number | null
  sea?: number | null
  roadKm?: number | null
  roadBase?: number | null
  border?: number | null
  local?: number | null
}

export type SettingsResponse = {
  settings?: {
    region?: string | null
    bayCapacity?: number | null
    bayHotPct?: number | null
    bayACapacity?: number | null
    bayBCapacity?: number | null
    bayAHotPct?: number | null
    bayBHotPct?: number | null
    bayAutoHot?: boolean | null
  } | null
}

export type WeatherResponse = {
  tempC?: number
  summary?: string
  location?: string
  error?: string
}

export type Payment = {
  id: string
  txRef: string
  amount: number
  currency: string
  status: string
  provider: string
  channel: string
  createdAt: string
  completedAt?: string | null
  user?: { id: string; name: string | null; email: string; role: string }
}

export type InventoryProduct = {
  id: string
  name: string
  price: number
  brand: string | null
  desc: string | null
  imageUrl: string | null
  baseStock: number
  createdAt?: string
}

export type RiderAdminRow = {
  id: string
  name: string | null
  email: string | null
  riderState?: {
    status?: string | null
    pendingCash?: number | null
    currentVol?: number | null
    lastLat?: number | null
    lastLng?: number | null
    lastLocationAt?: string | null
  } | null
  riderTasks?: { id: string; type: string; loc: string; status: string }[]
}

export type SystemSettingsResponse = {
  settings?: {
    dispatchRadiusKm?: number | null
  } | null
}

export type RiderDashboardState = {
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

export type RiderDashboardTask = {
  id: string
  type: "pickup" | "drop" | string
  loc: string
  note?: string | null
  status: "pending" | "active" | "done" | string
  revenue: number
  sequence: number
}

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "")
const ENABLE_DIRECT_CLIENT_GATEWAY = process.env.NEXT_PUBLIC_ENABLE_CLIENT_GATEWAY_PROXY === "true"

function apiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path
  const normalized = path.startsWith("/") ? path : `/${path}`
  if (normalized.startsWith("/api/auth/")) return normalized
  if (!ENABLE_DIRECT_CLIENT_GATEWAY) return normalized
  return API_BASE ? `${API_BASE}${normalized}` : normalized
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  })
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`)
  }
  return (await res.json()) as T
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1
      }
    }
  })
}

let browserQueryClient: QueryClient | undefined

export function getQueryClient() {
  if (typeof window === "undefined") {
    return createQueryClient()
  }
  if (!browserQueryClient) {
    browserQueryClient = createQueryClient()
  }
  return browserQueryClient
}

export const queryKeys = {
  ledger: (limit: number) => ["finance", "ledger", limit] as const,
  orders: (all: boolean) => ["orders", all ? "all" : "default"] as const,
  users: ["users"] as const,
  adminPros: ["admin", "pros"] as const,
  audit: (take: number) => ["audit", take] as const,
  analytics: ["analytics"] as const,
  analyticsTrends: ["analytics", "trends"] as const,
  health: ["health"] as const,
  authSession: ["auth", "session"] as const,
  rateCard: ["rate-card"] as const,
  me: ["me"] as const,
  settings: ["settings"] as const,
  weather: (region: string) => ["weather", region] as const,
  payments: ["payments"] as const,
  inventory: ["inventory"] as const,
  riderAdmin: ["rider", "admin"] as const,
  systemSettings: ["system-settings"] as const,
  riderDashboard: ["rider", "dashboard"] as const
}

export function useLedgerQuery(limit = 200) {
  return useQuery({
    queryKey: queryKeys.ledger(limit),
    queryFn: async () => {
      const data = await apiFetch<{ entries?: LedgerEntry[] }>(`/api/finance/ledger?limit=${limit}`)
      return Array.isArray(data.entries) ? data.entries : []
    }
  })
}

export function useOrdersQuery(all = true) {
  return useQuery({
    queryKey: queryKeys.orders(all),
    queryFn: async () => {
      const data = await apiFetch<{ orders?: OrderRow[] }>(`/api/orders?all=${all ? 1 : 0}`)
      return Array.isArray(data.orders) ? data.orders : []
    }
  })
}

export function useUsersQuery() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: async () => {
      const data = await apiFetch<{ users?: UserRow[] }>("/api/users")
      return Array.isArray(data.users) ? data.users : []
    }
  })
}

export function useAdminProsQuery() {
  return useQuery({
    queryKey: queryKeys.adminPros,
    queryFn: async () => {
      const data = await apiFetch<{ pros?: ProRow[] }>("/api/admin/pros")
      return Array.isArray(data.pros) ? data.pros : []
    }
  })
}

export function useAuditLogsQuery(take = 120) {
  return useQuery({
    queryKey: queryKeys.audit(take),
    queryFn: async () => {
      const data = await apiFetch<{ logs?: AuditLog[] }>(`/api/audit?take=${take}`)
      return Array.isArray(data.logs) ? data.logs : []
    }
  })
}

export function useAnalyticsQuery() {
  return useQuery({
    queryKey: queryKeys.analytics,
    queryFn: () => apiFetch<Analytics>("/api/analytics")
  })
}

export function useAnalyticsTrendsQuery() {
  return useQuery({
    queryKey: queryKeys.analyticsTrends,
    queryFn: async () => {
      const data = await apiFetch<{ series?: TrendSeries[] }>("/api/analytics/trends")
      return Array.isArray(data.series) ? data.series : []
    }
  })
}

export function useHealthQuery() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => apiFetch<{ db?: string; error?: string; ok?: boolean; status?: string }>("/api/health"),
    refetchInterval: 45_000
  })
}

export function useAuthSessionQuery() {
  return useQuery({
    queryKey: queryKeys.authSession,
    queryFn: () => apiFetch<any>("/api/auth/session"),
    retry: false,
    refetchInterval: 45_000
  })
}

export function useRateCardQuery() {
  return useQuery({
    queryKey: queryKeys.rateCard,
    queryFn: () => apiFetch<{ card?: RateCard | null }>("/api/rate-card")
  })
}

export function useMeQuery() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiFetch<{ user?: { id?: string } | null }>("/api/me")
  })
}

export function useSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiFetch<SettingsResponse>("/api/settings")
  })
}

export function useWeatherQuery(region: string) {
  return useQuery({
    queryKey: queryKeys.weather(region),
    queryFn: () => apiFetch<WeatherResponse>(`/api/weather?region=${encodeURIComponent(region)}`),
    refetchInterval: 300_000
  })
}

export function usePaymentsQuery() {
  return useQuery({
    queryKey: queryKeys.payments,
    queryFn: async () => {
      const data = await apiFetch<{ payments?: Payment[] }>("/api/payments")
      return Array.isArray(data.payments) ? data.payments : []
    }
  })
}

export function useInventoryQuery() {
  return useQuery({
    queryKey: queryKeys.inventory,
    queryFn: async () => {
      const data = await apiFetch<{ items?: InventoryProduct[] }>("/api/inventory")
      return Array.isArray(data.items) ? data.items : []
    }
  })
}

export function useRiderAdminQuery() {
  return useQuery({
    queryKey: queryKeys.riderAdmin,
    queryFn: async () => {
      const data = await apiFetch<{ riders?: RiderAdminRow[] }>("/api/rider/admin")
      return Array.isArray(data.riders) ? data.riders : []
    }
  })
}

export function useSystemSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.systemSettings,
    queryFn: () => apiFetch<SystemSettingsResponse>("/api/system-settings")
  })
}

export function useRiderDashboardQuery() {
  return useQuery({
    queryKey: queryKeys.riderDashboard,
    queryFn: () => apiFetch<{ state?: RiderDashboardState; tasks?: RiderDashboardTask[] }>("/api/rider/dashboard"),
    refetchInterval: 20_000
  })
}
