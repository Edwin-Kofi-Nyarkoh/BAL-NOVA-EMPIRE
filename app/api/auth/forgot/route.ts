import { prisma } from "@/lib/server/prisma"
import { notifyPasswordReset } from "@/lib/server/notifications"
import crypto from "crypto"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const email = String(body.email || "").toLowerCase().trim()

  if (!email || !email.includes("@")) {
    return Response.json({ error: "Invalid email" }, { status: 400 })
  }

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
