import { prisma } from "@/lib/server/prisma"
import { getClientIp, rateLimitSecure } from "@/lib/server/rate-limit"
import { z } from "zod"
import crypto from "crypto"
import bcrypt from "bcryptjs"

const resetSchema = z.object({
  token: z.string().min(20).max(256),
  password: z.string().min(8).max(200)
})

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const limiter = await rateLimitSecure(`reset:${ip}`, 8, 10 * 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = resetSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid token or password" }, { status: 400 })
  }
  const { token, password } = parsed.data

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
  const reset = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() }
    }
  })

  if (!reset) {
    return Response.json({ error: "Token expired or invalid" }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { password: passwordHash }
    }),
    prisma.passwordResetToken.update({
      where: { id: reset.id },
      data: { usedAt: new Date() }
    })
  ])

  return Response.json({ ok: true })
}
