type RateLimitResult = {
  ok: boolean
  remaining: number
  resetMs: number
}

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

function now() {
  return Date.now()
}

export function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  const real = req.headers.get("x-real-ip")
  if (real) return real.trim()
  return "unknown"
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const ts = now()
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= ts) {
    buckets.set(key, { count: 1, resetAt: ts + windowMs })
    return { ok: true, remaining: limit - 1, resetMs: ts + windowMs }
  }
  if (existing.count >= limit) {
    return { ok: false, remaining: 0, resetMs: existing.resetAt }
  }
  existing.count += 1
  return { ok: true, remaining: limit - existing.count, resetMs: existing.resetAt }
}
