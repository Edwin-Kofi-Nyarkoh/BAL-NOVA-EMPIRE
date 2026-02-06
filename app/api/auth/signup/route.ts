import { prisma } from "@/lib/server/prisma"
import bcrypt from "bcryptjs"
import { getServerSession } from "next-auth/next"
import { authConfig } from "@/lib/auth"
import { logAuditEvent } from "@/lib/server/audit"
import { notifyPartnerSignup } from "@/lib/server/notifications"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const name = String(body.name || "").trim()
  const email = String(body.email || "").toLowerCase().trim()
  const password = String(body.password || "")
  const role = String(body.role || "user")
  const session = await getServerSession(authConfig)

  if (!name || !email || !password) {
    return Response.json({ error: "Missing fields" }, { status: 400 })
  }
  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }
  if (!email.includes("@")) {
    return Response.json({ error: "Invalid email" }, { status: 400 })
  }

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) {
    return Response.json({ error: "Email already registered" }, { status: 409 })
  }

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
  const created = await prisma.user.create({
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
