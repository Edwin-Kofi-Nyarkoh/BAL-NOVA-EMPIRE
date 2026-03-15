function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function allowedOrigins() {
  const envOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
  const nextAuthOrigin = process.env.NEXTAUTH_URL
    ? new URL(process.env.NEXTAUTH_URL).origin
    : ""
  return unique([nextAuthOrigin, ...envOrigins])
}

function resolveOrigin(req: Request) {
  const requestOrigin = req.headers.get("origin") || ""
  const allowed = allowedOrigins()
  if (!requestOrigin) return allowed[0] || "null"
  if (allowed.includes(requestOrigin)) return requestOrigin
  return "null"
}

export function buildCorsHeaders(
  req?: Request,
  methods = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
) {
  const origin = req ? resolveOrigin(req) : allowedOrigins()[0] || "null"
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin"
  }
}

export const corsHeaders = buildCorsHeaders()

export function applyCors(res: Response): Response
export function applyCors(req: Request, res: Response, methods?: string): Response
export function applyCors(arg1: Request | Response, arg2?: Response, methods?: string) {
  const req = arg1 instanceof Request ? arg1 : undefined
  const res = arg1 instanceof Request ? arg2 : arg1
  if (!res) throw new Error("Response is required")
  const headers = buildCorsHeaders(req, methods)
  Object.entries(headers).forEach(([key, value]) => {
    res.headers.set(key, value)
  })
  return res
}
