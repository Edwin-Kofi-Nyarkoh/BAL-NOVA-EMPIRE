import "dotenv/config"
import http from "node:http"
import { URL } from "node:url"

const PORT = Number(process.env.PORT || process.env.GATEWAY_PORT || 8080)
const SERVICE_CLIENT_KEY = process.env.SERVICE_CLIENT_KEY || ""
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || ""
const LEGACY_API_BASE = (process.env.NEXT_LEGACY_API_BASE || "http://localhost:3000").replace(/\/+$/, "")
const SERVICE_URLS: Record<string, string> = {
  api: process.env.API_SERVICE_URL || "http://localhost:8101"
}

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

function json(res: http.ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(payload))
}

function getIp(req: http.IncomingMessage) {
  const xff = req.headers["x-forwarded-for"]
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim()
  return req.socket.remoteAddress || "unknown"
}

function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (existing.count >= limit) return false
  existing.count += 1
  return true
}

function requiresClientKey(service: string, path: string) {
  return service === "api" && path !== "health"
}

async function readBody(req: http.IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  return chunks.length ? Buffer.concat(chunks) : null
}

async function proxyRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  target: string,
  body: Buffer | null
) {
  const normalizedBody = body ? new Uint8Array(body) : undefined
  const upstream = await fetch(target, {
    method: req.method || "GET",
    headers: {
      "content-type": String(req.headers["content-type"] || "application/json"),
      authorization: String(req.headers.authorization || ""),
      "x-user-id": String(req.headers["x-user-id"] || ""),
      "x-user-role": String(req.headers["x-user-role"] || ""),
      "x-user-email": String(req.headers["x-user-email"] || ""),
      "x-internal-key": INTERNAL_SERVICE_KEY
    },
    body: req.method === "GET" || req.method === "OPTIONS" ? undefined : normalizedBody
  })
  const text = await upstream.text()
  res.writeHead(upstream.status, {
    "Content-Type": upstream.headers.get("content-type") || "application/json"
  })
  res.end(text)
}

function resolveRoute(pathname: string) {
  const trimmed = pathname.replace(/^\/+|\/+$/g, "")
  const noApiPrefix = trimmed.startsWith("api/") ? trimmed.slice(4) : trimmed
  const parts = noApiPrefix.split("/").filter(Boolean)
  if (!parts.length) return { service: "api", subpath: "" }
  const first = parts[0]
  if (SERVICE_URLS[first]) {
    return { service: first, subpath: parts.slice(1).join("/") }
  }
  return { service: "api", subpath: noApiPrefix }
}

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) return json(res, 400, { error: "Bad request" })
  if (req.url === "/health") return json(res, 200, { ok: true, service: "gateway" })

  const url = new URL(req.url, "http://localhost")
  const { service, subpath } = resolveRoute(url.pathname)
  const base = SERVICE_URLS[service]
  if (!base) return json(res, 404, { error: `Unknown service '${service}'` })

  const ip = getIp(req)
  if (!rateLimit(`${ip}:${service}:${subpath}`, 180, 60_000)) {
    return json(res, 429, { error: "Too many requests." })
  }

  if (requiresClientKey(service, subpath)) {
    const provided = String(req.headers["x-service-client-key"] || "")
    if (!SERVICE_CLIENT_KEY || provided !== SERVICE_CLIENT_KEY) {
      return json(res, 401, { error: "Unauthorized client." })
    }
  }

  const body = await readBody(req)
  const serviceUrl = `${base.replace(/\/+$/, "")}/${subpath}${url.search || ""}`

  try {
    await proxyRequest(req, res, serviceUrl, body)
    return
  } catch {
    // Fallback to legacy Next API for not-yet-migrated handlers.
  }

  try {
    const legacyUrl = `${LEGACY_API_BASE}/api/${subpath}${url.search || ""}`
    const normalizedBody = body ? new Uint8Array(body) : undefined
    const upstream = await fetch(legacyUrl, {
      method: req.method,
      headers: {
        "content-type": String(req.headers["content-type"] || "application/json"),
        authorization: String(req.headers.authorization || "")
      },
      body: req.method === "GET" || req.method === "OPTIONS" ? undefined : normalizedBody
    })
    const text = await upstream.text()
    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/json"
    })
    res.end(text)
  } catch {
    json(res, 502, { error: "Upstream unavailable." })
  }
})

server.listen(PORT, () => {
  console.log(`BAL Gateway listening on http://localhost:${PORT}`)
})
