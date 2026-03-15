import http from "node:http"

export function json(res: http.ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    ...corsHeaders()
  })
  res.end(JSON.stringify(payload))
}

export function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Service-Client-Key"
  }
}

export async function readJsonBody(req: http.IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  if (!chunks.length) return {}
  const raw = Buffer.concat(chunks).toString("utf8")
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }

  if (current.count >= limit) return { ok: false }
  current.count += 1
  return { ok: true }
}

export function getIp(req: http.IncomingMessage) {
  const xff = req.headers["x-forwarded-for"]
  if (typeof xff === "string" && xff.length) {
    return xff.split(",")[0].trim()
  }
  return req.socket.remoteAddress || "unknown"
}
