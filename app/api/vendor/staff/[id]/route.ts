import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const staffUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: z.string().min(2).max(40).optional()
})

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(_req)
  const limiter = rateLimit(`vendor_staff_del:${ip}`, 20, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const { id } = await params

  const staff = await prisma.vendorStaff.findUnique({ where: { id } })
  if (!staff || staff.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.vendorStaff.delete({ where: { id } })
  return Response.json({ ok: true })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`vendor_staff_upd:${ip}`, 30, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const { id } = await params

  const staff = await prisma.vendorStaff.findUnique({ where: { id } })
  if (!staff || staff.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = staffUpdateSchema.safeParse({
    name: typeof body.name === "string" ? body.name.trim() : undefined,
    role: typeof body.role === "string" ? body.role.trim() : undefined
  })
  if (!parsed.success) {
    return Response.json({ error: "Invalid staff payload" }, { status: 400 })
  }
  const { name, role } = parsed.data

  const updated = await prisma.vendorStaff.update({
    where: { id },
    data: {
      name: name ?? staff.name,
      role: role ?? staff.role
    }
  })

  return Response.json({ staff: updated })
}
