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
let lastPruneAt = 0

function now() {
  return Date.now()
}

function pruneBuckets(ts: number) {
  if (ts - lastPruneAt < 60_000) return
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= ts) buckets.delete(key)
  }
  lastPruneAt = ts
}

export function getClientIp(req: Request) {
  const cf = req.headers.get("cf-connecting-ip")
  if (cf) return cf.trim()
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  const real = req.headers.get("x-real-ip")
  if (real) return real.trim()
  return "unknown"
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const ts = now()
  pruneBuckets(ts)
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

type UpstashLimiter = {
  limit: (key: string) => Promise<{ success: boolean; remaining: number; reset: number }>
}

const upstashLimiters = new Map<string, UpstashLimiter>()

async function getUpstashLimiter(limit: number, windowMs: number) {
  const limiterKey = `${limit}:${windowMs}`
  const cached = upstashLimiters.get(limiterKey)
  if (cached) return cached

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return undefined

  const { Redis } = await import("@upstash/redis")
  const { Ratelimit } = await import("@upstash/ratelimit")

  const redis = new Redis({ url, token })
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000))
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`)
  })

  const wrapped: UpstashLimiter = {
    limit: (key: string) => rl.limit(key) as Promise<{ success: boolean; remaining: number; reset: number }>
  }
  upstashLimiters.set(limiterKey, wrapped)
  return wrapped
}

export async function rateLimitSecure(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const limiter = await getUpstashLimiter(limit, windowMs).catch(() => undefined)
  if (!limiter) {
    return rateLimit(key, limit, windowMs)
  }
  const result = await limiter.limit(key)
  return {
    ok: result.success,
    remaining: result.remaining,
    resetMs: result.reset
  }
}
