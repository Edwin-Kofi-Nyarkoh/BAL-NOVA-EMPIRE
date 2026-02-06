import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"

type IncomingItem = {
  productId?: string | null
  name: string
  price: number
  qty: number
}

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
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))

  const name = String(body.name || "").trim()
  if (!name) {
    return Response.json({ error: "Snapshot name is required" }, { status: 400 })
  }

  let items = Array.isArray(body.items) ? (body.items as IncomingItem[]) : []
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
