import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const updateAddressSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  note: z.string().max(500).optional().nullable()
})

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(_req)
  const limiter = rateLimit(`addr_del:${ip}`, 20, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const { id } = await params

  const address = await prisma.address.findUnique({ where: { id } })
  if (!address || address.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.address.delete({ where: { id } })
  return Response.json({ ok: true })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`addr_upd:${ip}`, 30, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const { id } = await params

  const address = await prisma.address.findUnique({ where: { id } })
  if (!address || address.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = updateAddressSchema.safeParse({
    label: typeof body.label === "string" ? body.label.trim() : undefined,
    note: typeof body.note === "string" ? body.note.trim() : body.note ?? undefined
  })
  if (!parsed.success) {
    return Response.json({ error: "Invalid address payload" }, { status: 400 })
  }
  const { label, note } = parsed.data

  const updated = await prisma.address.update({
    where: { id },
    data: {
      label: label ?? address.label,
      note: note ?? address.note
    }
  })

  return Response.json({ address: updated })
}
