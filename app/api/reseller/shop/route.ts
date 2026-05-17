import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const shopItemSchema = z.object({
  sourceItemId: z.string().max(80).optional().nullable(),
  name: z.string().min(1).max(200),
  price: z.coerce.number().min(0).max(1_000_000),
  myProfit: z.coerce.number().min(0).max(1_000_000).optional(),
  sellingPrice: z.coerce.number().min(0).max(1_000_000),
  myCategory: z.string().max(120).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable()
})

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id
  const items = await prisma.resellerShopItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  })
  return Response.json({ items })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`reseller_shop_post:${ip}`, 40, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const parsed = shopItemSchema.safeParse(body.item || body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid shop item payload" }, { status: 400 })
  }
  const data = parsed.data
  const existing = data.sourceItemId
    ? await prisma.resellerShopItem.findFirst({
        where: { userId, sourceItemId: data.sourceItemId }
      })
    : null

  const item = existing
    ? await prisma.resellerShopItem.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          price: data.price,
          myProfit: data.myProfit ?? 0,
          sellingPrice: data.sellingPrice,
          myCategory: data.myCategory ?? null,
          imageUrl: data.imageUrl ?? null
        }
      })
    : await prisma.resellerShopItem.create({
        data: {
          userId,
          sourceItemId: data.sourceItemId ?? null,
          name: data.name,
          price: data.price,
          myProfit: data.myProfit ?? 0,
          sellingPrice: data.sellingPrice,
          myCategory: data.myCategory ?? null,
          imageUrl: data.imageUrl ?? null
        }
      })

  return Response.json({ item })
}
