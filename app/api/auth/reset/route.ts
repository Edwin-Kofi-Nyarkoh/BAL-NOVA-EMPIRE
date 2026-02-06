import { prisma } from "@/lib/server/prisma"
import crypto from "crypto"
import bcrypt from "bcryptjs"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const token = String(body.token || "")
  const password = String(body.password || "")

  if (!token || token.length < 20) {
    return Response.json({ error: "Invalid token" }, { status: 400 })
  }
  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }

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
