import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const name = String(body.name || "").trim()

  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 })
  }

  const hub = await prisma.vendorHub.findUnique({ where: { id: params.id } })
  if (!hub || hub.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const updated = await prisma.vendorHub.update({
    where: { id: params.id },
    data: { name }
  })

  return Response.json({ hub: updated })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id

  const hub = await prisma.vendorHub.findUnique({ where: { id: params.id } })
  if (!hub || hub.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.vendorHub.delete({ where: { id: params.id } })
  return Response.json({ ok: true })
}
