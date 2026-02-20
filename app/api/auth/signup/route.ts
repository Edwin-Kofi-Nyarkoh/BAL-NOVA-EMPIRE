import { prisma } from "@/lib/server/prisma"
import bcrypt from "bcryptjs"
import { getServerSession } from "next-auth/next"
import { authConfig } from "@/lib/auth"
import { logAuditEvent } from "@/lib/server/audit"
import { notifyPartnerSignup } from "@/lib/server/notifications"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const limiter = rateLimit(`signup:${ip}`, 10, 10 * 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const schema = z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().email().max(190),
    password: z.string().min(8).max(128),
    role: z.string().optional()
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })
  }

  const name = parsed.data.name
  const email = parsed.data.email.toLowerCase().trim()
  const password = parsed.data.password
  const role = String(parsed.data.role || "user")
  const session = await getServerSession(authConfig)

  const sessionRole = (session?.user as any)?.role || "user"
  const partnerRoles = new Set(["vendor", "rider", "reseller", "pro"])
  const publicRoles = new Set(["user", ...partnerRoles])

  let finalRole = "user"
  if (sessionRole === "admin") {
    finalRole = role || "user"
  } else {
    finalRole = publicRoles.has(role) ? role : "user"
  }

  const approvalStatus = sessionRole === "admin" || finalRole === "user" ? "approved" : "pending"

  const passwordHash = await bcrypt.hash(password, 10)
  let created
  try {
    created = await prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
        role: finalRole,
        approvalStatus,
        approvedAt: approvalStatus === "approved" ? new Date() : null,
        approvedById: approvalStatus === "approved" && sessionRole === "admin" ? (session?.user as any)?.id : null
      }
    })
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: "Email already registered" }, { status: 409 })
    }
    if (error?.code === "ETIMEDOUT") {
      return Response.json({ error: "Database connection timed out" }, { status: 503 })
    }
    return Response.json({ error: "Signup failed" }, { status: 500 })
  }

  await logAuditEvent({
    actor: session?.user,
    action: "users.create",
    entityType: "User",
    entityId: created.id,
    metadata: { role: finalRole, email, approvalStatus }
  })

  if (approvalStatus === "pending") {
    await notifyPartnerSignup({ email, name, role: finalRole })
  }

  return Response.json({
    ok: true,
    approvalStatus,
    message:
      approvalStatus === "pending"
        ? "Account submitted for approval. You will be notified once approved."
        : "Account created."
  })
}
