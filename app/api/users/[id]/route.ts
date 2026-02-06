import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import bcrypt from "bcryptjs"
import { logAuditEvent } from "@/lib/server/audit"
import { applyCors, corsHeaders } from "@/lib/server/cors"

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return applyCors(auth.response)

  const id = params.id
  const body = await req.json().catch(() => ({}))
  const role = typeof body.role === "string" ? body.role : undefined
  const password = typeof body.password === "string" ? body.password : undefined
  const name = typeof body.name === "string" ? body.name.trim() : undefined
  const approvalStatus = typeof body.approvalStatus === "string" ? body.approvalStatus : undefined

  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404, headers: corsHeaders })
  }

  const allowedRoles = new Set(["admin", "user", "vendor", "rider", "reseller", "pro"])
  if (role && !allowedRoles.has(role)) {
    return Response.json({ error: "Invalid role" }, { status: 400, headers: corsHeaders })
  }
  const allowedStatuses = new Set(["pending", "approved", "rejected"])
  if (approvalStatus && !allowedStatuses.has(approvalStatus)) {
    return Response.json({ error: "Invalid approval status" }, { status: 400, headers: corsHeaders })
  }

  if (role && user.role === "admin" && role !== "admin") {
    const adminCount = await prisma.user.count({ where: { role: "admin" } })
    if (adminCount <= 1) {
      return Response.json({ error: "At least one admin is required" }, { status: 400, headers: corsHeaders })
    }
  }

  const data: { role?: string; password?: string; name?: string; approvalStatus?: string; approvedAt?: Date | null; approvedById?: string | null } = {}

  if (role) data.role = role
  if (name) data.name = name
  if (approvalStatus) {
    data.approvalStatus = approvalStatus
    data.approvedAt = approvalStatus === "approved" ? new Date() : null
    data.approvedById = approvalStatus === "approved" ? (auth.session.user as any)?.id : null
  }
  if (password) {
    if (password.length < 8) {
      return Response.json({ error: "Password must be at least 8 characters" }, { status: 400, headers: corsHeaders })
    }
    data.password = await bcrypt.hash(password, 10)
  }

  if (!Object.keys(data).length) {
    return Response.json({ error: "No updates provided" }, { status: 400, headers: corsHeaders })
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, approvalStatus: true, createdAt: true }
  })

  await logAuditEvent({
    actor: auth.session.user,
    action: "users.update",
    entityType: "User",
    entityId: updated.id,
    metadata: { role: updated.role, name: updated.name, approvalStatus: updated.approvalStatus }
  })

  return Response.json({ user: updated }, { headers: corsHeaders })
}
