import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id

  const address = await prisma.address.findUnique({ where: { id: params.id } })
  if (!address || address.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.address.delete({ where: { id: params.id } })
  return Response.json({ ok: true })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id

  const address = await prisma.address.findUnique({ where: { id: params.id } })
  if (!address || address.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const label = typeof body.label === "string" ? body.label.trim() : undefined
  const note = typeof body.note === "string" ? body.note.trim() : undefined

  if (label !== undefined && !label) {
    return Response.json({ error: "Label is required" }, { status: 400 })
  }

  const updated = await prisma.address.update({
    where: { id: params.id },
    data: {
      label: label ?? address.label,
      note: note ?? address.note
    }
  })

  return Response.json({ address: updated })
}
