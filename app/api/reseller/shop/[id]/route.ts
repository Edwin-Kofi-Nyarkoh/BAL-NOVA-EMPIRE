import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const shopUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  price: z.coerce.number().min(0).max(1_000_000).optional(),
  myProfit: z.coerce.number().min(0).max(1_000_000).optional(),
  sellingPrice: z.coerce.number().min(0).max(1_000_000).optional(),
  myCategory: z.string().max(120).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable()
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`reseller_shop_patch:${ip}`, 60, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = shopUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid shop item payload" }, { status: 400 })
  }

  const existing = await prisma.resellerShopItem.findFirst({ where: { id, userId } })
  if (!existing) {
    return Response.json({ error: "Shop item not found" }, { status: 404 })
  }

  const item = await prisma.resellerShopItem.update({
    where: { id },
    data: parsed.data
  })

  return Response.json({ item })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`reseller_shop_delete:${ip}`, 30, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const { id } = await params
  const existing = await prisma.resellerShopItem.findFirst({ where: { id, userId } })
  if (!existing) {
    return Response.json({ error: "Shop item not found" }, { status: 404 })
  }
  await prisma.resellerShopItem.delete({ where: { id } })
  return Response.json({ ok: true })
}
