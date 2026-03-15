import { SignJWT, jwtVerify } from "jose"
import type http from "node:http"
import type { AuthUser } from "./types"

const SECRET = process.env.MOBILE_AUTH_SECRET || process.env.NEXTAUTH_SECRET || ""
const SECRET_KEY = new TextEncoder().encode(SECRET)

function assertSecret() {
  if (!SECRET) {
    throw new Error("Missing MOBILE_AUTH_SECRET or NEXTAUTH_SECRET")
  }
}

export async function signMobileToken(user: AuthUser) {
  assertSecret()
  return new SignJWT({
    email: user.email || null,
    name: user.name || null,
    role: user.role,
    approvalStatus: user.approvalStatus
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(SECRET_KEY)
}

export async function userFromAuthHeader(req: http.IncomingMessage): Promise<AuthUser | null> {
  assertSecret()
  const authHeader = String(req.headers.authorization || "")
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null
  const token = authHeader.slice(7).trim()
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, SECRET_KEY)
    return {
      id: String(payload.sub || ""),
      email: typeof payload.email === "string" ? payload.email : null,
      name: typeof payload.name === "string" ? payload.name : null,
      role: typeof payload.role === "string" ? payload.role : "user",
      approvalStatus: typeof payload.approvalStatus === "string" ? payload.approvalStatus : "approved"
    }
  } catch {
    return null
  }
}

export function isInternalRequest(req: http.IncomingMessage) {
  const expected = process.env.INTERNAL_SERVICE_KEY || ""
  if (!expected) return false
  return String(req.headers["x-internal-key"] || "") === expected
}
