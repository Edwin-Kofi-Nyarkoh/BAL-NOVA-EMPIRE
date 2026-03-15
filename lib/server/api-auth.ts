import { getServerSession } from "next-auth/next"
import { headers } from "next/headers"
import { authConfig } from "@/lib/auth"
import { verifyMobileToken } from "@/lib/server/mobile-auth"

type AuthResult =
  | { ok: true; session: any }
  | { ok: false; response: Response }

export async function requireUser(): Promise<AuthResult> {
  const session = await getServerSession(authConfig)
  let resolved = session

  if (!resolved?.user) {
    const authHeader = (await headers()).get("authorization") || ""
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice(7).trim()
      try {
        const payload = await verifyMobileToken(token)
        resolved = {
          user: {
            id: payload.sub,
            name: payload.name || null,
            email: payload.email || null,
            role: payload.role || "user",
            approvalStatus: payload.approvalStatus || "approved"
          }
        } as any
      } catch {
        return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) }
      }
    }
  }

  if (!resolved?.user) {
    return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const approvalStatus = (resolved.user as any)?.approvalStatus || "approved"
  if (approvalStatus !== "approved") {
    return { ok: false, response: Response.json({ error: "Account pending approval" }, { status: 403 }) }
  }
  return { ok: true, session: resolved }
}

export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireUser()
  if (!result.ok) return result
  const role = (result.session.user as any)?.role || "user"
  if (role !== "admin") {
    return { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return result
}

export async function requireRole(roles: string[]): Promise<AuthResult> {
  const result = await requireUser()
  if (!result.ok) return result
  const role = (result.session.user as any)?.role || "user"
  if (!roles.includes(role)) {
    return { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return result
}

export async function requireRider(): Promise<AuthResult> {
  return requireRole(["rider", "admin"])
}
