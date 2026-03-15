import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import bcrypt from "bcryptjs"
import { logAuditEvent } from "@/lib/server/audit"
import { applyCors, corsHeaders } from "@/lib/server/cors"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const updateUserSchema = z.object({
  role: z.string().min(2).max(20).optional(),
  password: z.string().min(8).max(200).optional(),
  name: z.string().min(1).max(120).optional(),
  approvalStatus: z.string().min(3).max(20).optional()
})

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return applyCors(auth.response)
  const ip = getClientIp(req)
  const limiter = rateLimit(`admin_user_patch:${ip}`, 30, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429, headers: corsHeaders })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = updateUserSchema.safeParse({
    role: typeof body.role === "string" ? body.role : undefined,
    password: typeof body.password === "string" ? body.password : undefined,
    name: typeof body.name === "string" ? body.name.trim() : undefined,
    approvalStatus: typeof body.approvalStatus === "string" ? body.approvalStatus : undefined
  })
  if (!parsed.success) {
    return Response.json({ error: "Invalid user payload" }, { status: 400, headers: corsHeaders })
  }
  const { role, password, name, approvalStatus } = parsed.data

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
