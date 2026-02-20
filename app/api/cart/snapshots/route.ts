import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

type IncomingItem = {
  productId?: string | null
  name: string
  price: number
  qty: number
}

const snapshotItemSchema = z.object({
  productId: z.string().min(1).max(80).optional().nullable(),
  name: z.string().min(1).max(200),
  price: z.coerce.number().min(0).max(1_000_000),
  qty: z.coerce.number().int().min(1).max(999)
})

const snapshotSchema = z.object({
  name: z.string().min(1).max(120),
  items: z.array(snapshotItemSchema).max(200).optional()
})

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id

  const snapshots = await prisma.cartSnapshot.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: true }
  })

  return Response.json({ snapshots })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`cart_snapshot:${ip}`, 20, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const parsed = snapshotSchema.safeParse({
    name: typeof body.name === "string" ? body.name.trim() : "",
    items: Array.isArray(body.items) ? body.items : undefined
  })
  if (!parsed.success) {
    return Response.json({ error: "Snapshot name is required" }, { status: 400 })
  }
  const name = parsed.data.name

  let items = (parsed.data.items || []) as IncomingItem[]
  if (!items.length) {
    const cart = await prisma.cart.findUnique({ where: { userId }, include: { items: true } })
    items = (cart?.items || []).map((i) => ({
      productId: i.productId,
      name: i.name,
      price: i.price,
      qty: i.qty
    }))
  }

  const cleaned = items
    .map((i) => ({
      productId: i.productId || null,
      name: String(i.name || "").trim(),
      price: Number(i.price || 0),
      qty: Math.max(1, Number(i.qty || 1))
    }))
    .filter((i) => i.name.length > 0)

  const snapshot = await prisma.cartSnapshot.create({
    data: {
      userId,
      name
    }
  })

  if (cleaned.length) {
    await prisma.cartSnapshotItem.createMany({
      data: cleaned.map((i) => ({
        snapshotId: snapshot.id,
        productId: i.productId,
        name: i.name,
        price: i.price,
        qty: i.qty
      }))
    })
  }

  const fresh = await prisma.cartSnapshot.findUnique({
    where: { id: snapshot.id },
    include: { items: true }
  })

  return Response.json({ snapshot: fresh })
}
