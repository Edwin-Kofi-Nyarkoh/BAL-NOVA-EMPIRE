import { prisma } from "@/lib/server/prisma"
import { notifyPasswordReset } from "@/lib/server/notifications"
import { getClientIp, rateLimitSecure } from "@/lib/server/rate-limit"
import { z } from "zod"
import crypto from "crypto"

const forgotSchema = z.object({
  email: z.string().email().max(254)
})

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const limiter = await rateLimitSecure(`forgot:${ip}`, 6, 10 * 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = forgotSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid email" }, { status: 400 })
  }
  const email = parsed.data.email.toLowerCase().trim()

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return Response.json({ ok: true })
  }

  const rawToken = crypto.randomBytes(32).toString("hex")
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30)

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt
    }
  })

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  const link = `${baseUrl}/reset-password?token=${rawToken}`
  await notifyPasswordReset({ email: user.email, name: user.name, link })

  return Response.json({ ok: true })
}
