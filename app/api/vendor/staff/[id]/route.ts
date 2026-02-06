import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id

  const staff = await prisma.vendorStaff.findUnique({ where: { id: params.id } })
  if (!staff || staff.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.vendorStaff.delete({ where: { id: params.id } })
  return Response.json({ ok: true })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id

  const staff = await prisma.vendorStaff.findUnique({ where: { id: params.id } })
  if (!staff || staff.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === "string" ? body.name.trim() : undefined
  const role = typeof body.role === "string" ? body.role.trim() : undefined

  if (name !== undefined && !name) {
    return Response.json({ error: "Name is required" }, { status: 400 })
  }

  const updated = await prisma.vendorStaff.update({
    where: { id: params.id },
    data: {
      name: name ?? staff.name,
      role: role ?? staff.role
    }
  })

  return Response.json({ staff: updated })
}
