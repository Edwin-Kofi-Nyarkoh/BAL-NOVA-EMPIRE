import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`ledger_backfill:${ip}`, 3, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }

  const orders = await prisma.order.findMany({ orderBy: { createdAt: "asc" } })
  let created = 0

  for (const order of orders) {
    const windowStart = new Date(order.createdAt.getTime() - 10 * 60 * 1000)
    const windowEnd = new Date(order.createdAt.getTime() + 10 * 60 * 1000)

    const existing = await prisma.financeLedger.findFirst({
      where: {
        orderId: order.id
      }
    })

    if (existing) continue

    const fallback = await prisma.financeLedger.findFirst({
      where: {
        orderId: null,
        amount: order.price,
        note: `Order: ${order.item}`,
        createdAt: { gte: windowStart, lte: windowEnd }
      }
    })

    if (fallback) continue

    await prisma.financeLedger.create({
      data: {
        userId: order.userId || (auth.session.user as any).id,
        orderId: order.id,
        type: ["Completed", "Delivered"].includes(order.status) ? "REVENUE" : "ESCROW",
        amount: order.price,
        status: "posted",
        note: `Order: ${order.item}`
      }
    })
    created += 1
  }

  return Response.json({ created })
}
