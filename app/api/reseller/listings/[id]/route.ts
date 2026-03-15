import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  price: z.coerce.number().min(0).max(1_000_000).optional(),
  cost: z.coerce.number().min(0).max(1_000_000).optional(),
  status: z.string().min(2).max(20).optional()
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`reseller_listings_upd:${ip}`, 40, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid listing payload" }, { status: 400 })
  }
  const listing = await prisma.resellerListing.findUnique({ where: { id } })
  if (!listing || listing.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }
  const updated = await prisma.resellerListing.update({
    where: { id },
    data: parsed.data
  })
  return Response.json({ listing: updated })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`reseller_listings_del:${ip}`, 20, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const { id } = await params
  const listing = await prisma.resellerListing.findUnique({ where: { id } })
  if (!listing || listing.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }
  await prisma.resellerListing.delete({ where: { id } })
  return Response.json({ ok: true })
}
