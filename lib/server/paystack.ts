const PAYSTACK_BASE = "https://api.paystack.co"

function getSecret() {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) {
    throw new Error("Missing PAYSTACK_SECRET_KEY")
  }
  return secret
}

async function safeJson(res: Response) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export async function initializePaystackTransaction(payload: {
  email: string
  amount: number
  currency: string
  reference: string
  callback_url: string
  metadata?: Record<string, any>
}) {
  const secret = getSecret()
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })
  const data = await safeJson(res)
  if (!res.ok || data?.status !== true) {
    const message = data?.message || `Unable to initialize transaction (HTTP ${res.status})`
    throw new Error(message)
  }
  return data
}

export async function verifyPaystackTransaction(reference: string) {
  const secret = getSecret()
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` }
  })
  const data = await safeJson(res)
  if (!res.ok || data?.status !== true) {
    const message = data?.message || `Unable to verify transaction (HTTP ${res.status})`
    throw new Error(message)
  }
  return data
}
