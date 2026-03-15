const GATEWAY_URL = process.env.EXPO_PUBLIC_GATEWAY_URL || "http://localhost:8080"
const CLIENT_KEY = process.env.EXPO_PUBLIC_SERVICE_CLIENT_KEY || ""

type LoginResponse = {
  token: string
  user: {
    id: string
    email: string
    name: string
    role: string
    approvalStatus: string
  }
}

async function request<T>(path: string, method: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-service-client-key": CLIENT_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(String((data as any)?.error || `Request failed: ${res.status}`))
  }

  return data as T
}

export async function login(email: string, password: string) {
  return request<LoginResponse>("/api/auth/login", "POST", { email, password })
}

export async function forgotPassword(email: string) {
  return request<{ ok: boolean; devResetToken?: string }>("/api/auth/forgot-password", "POST", { email })
}

export async function fetchInventory(token: string) {
  return request<{ items: Array<{ id: string; name: string; price: number }> }>("/api/inventory", "GET", undefined, token)
}

export async function fetchFinanceSummary(token: string) {
  return request<{ summary: { paymentTotal: number; ledgerTotal: number; ledgerEntries: number; scope: string } }>(
    "/api/finance/summary",
    "GET",
    undefined,
    token
  )
}

export async function fetchAnalyticsOverview(token: string) {
  return request<{ overview: { users: number; orders: number; payments: number; inventoryItems: number } }>(
    "/api/analytics/overview",
    "GET",
    undefined,
    token
  )
}
