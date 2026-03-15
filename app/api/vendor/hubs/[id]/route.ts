import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const hubUpdateSchema = z.object({
  name: z.string().min(1).max(120)
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`vendor_hub_upd:${ip}`, 30, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = hubUpdateSchema.safeParse({ name: typeof body.name === "string" ? body.name.trim() : "" })
  if (!parsed.success) {
    return Response.json({ error: "Name is required" }, { status: 400 })
  }
  const { name } = parsed.data

  const hub = await prisma.vendorHub.findUnique({ where: { id } })
  if (!hub || hub.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const updated = await prisma.vendorHub.update({
    where: { id },
    data: { name }
  })

  return Response.json({ hub: updated })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(_req)
  const limiter = rateLimit(`vendor_hub_del:${ip}`, 20, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const { id } = await params

  const hub = await prisma.vendorHub.findUnique({ where: { id } })
  if (!hub || hub.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.vendorHub.delete({ where: { id } })
  return Response.json({ ok: true })
}
