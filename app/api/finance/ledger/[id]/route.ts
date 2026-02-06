import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const payload: { amount?: number; status?: string; note?: string } = {}

  if (body.amount !== undefined) payload.amount = Number(body.amount || 0)
  if (body.status) payload.status = String(body.status)
  if (body.note !== undefined) payload.note = String(body.note || "")

  const entry = await prisma.financeLedger.update({
    where: { id: params.id },
    data: payload
  })

  return Response.json({ entry })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  await prisma.financeLedger.delete({ where: { id: params.id } })
  return Response.json({ ok: true })
}
