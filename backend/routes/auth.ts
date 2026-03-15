import type { RouteHandler } from "../api/types"
import { json, getIp, rateLimit } from "../api/utils"
import { PrismaClient } from "../../generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"
import crypto from "node:crypto"
import { signMobileToken } from "../api/auth"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  log: ["error"]
})

const login: RouteHandler = async ({ req, res, body }) => {
  const ip = getIp(req)
  if (!rateLimit(`mobile_login:${ip}`, 15, 10 * 60_000).ok) {
    return json(res, 429, { error: "Too many requests. Try again later." })
  }

  const email = String((body as any)?.email || "").toLowerCase().trim()
  const password = String((body as any)?.password || "")
  if (!email || !password) {
    return json(res, 400, { error: "Email and password are required." })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return json(res, 401, { error: "Invalid credentials." })

  if ((user.approvalStatus || "approved") !== "approved") {
    return json(res, 403, { error: "Account pending approval." })
  }

  const ok = await bcrypt.compare(password, user.password)
  if (!ok) return json(res, 401, { error: "Invalid credentials." })

  const token = await signMobileToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role || "user",
    approvalStatus: user.approvalStatus || "approved"
  })

  return json(res, 200, {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || "user",
      approvalStatus: user.approvalStatus || "approved"
    }
  })
}

const forgotPassword: RouteHandler = async ({ req, res, body }) => {
  const ip = getIp(req)
  const email = String((body as any)?.email || "").toLowerCase().trim()

  if (!rateLimit(`forgot:${ip}`, 6, 10 * 60_000).ok) {
    return json(res, 429, { error: "Too many requests. Try again later." })
  }
  if (!email) return json(res, 400, { error: "Invalid email" })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return json(res, 200, { ok: true })

  const rawToken = crypto.randomBytes(32).toString("hex")
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
  const expiresAt = new Date(Date.now() + 30 * 60_000)

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt
    }
  })

  if (process.env.NODE_ENV !== "production") {
    return json(res, 200, { ok: true, devResetToken: rawToken })
  }

  return json(res, 200, { ok: true })
}

const resetPassword: RouteHandler = async ({ req, res, body }) => {
  const ip = getIp(req)
  if (!rateLimit(`reset:${ip}`, 8, 10 * 60_000).ok) {
    return json(res, 429, { error: "Too many requests. Try again later." })
  }

  const token = String((body as any)?.token || "")
  const password = String((body as any)?.password || "")
  if (token.length < 20 || password.length < 8) {
    return json(res, 400, { error: "Invalid token or password" })
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
  const reset = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() }
    }
  })

  if (!reset) return json(res, 400, { error: "Token expired or invalid" })

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { password: passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } })
  ])

  return json(res, 200, { ok: true })
}

export const authRoutes: Record<string, RouteHandler> = {
  "POST /auth/login": login,
  "POST /auth/forgot-password": forgotPassword,
  "POST /auth/reset-password": resetPassword
}
