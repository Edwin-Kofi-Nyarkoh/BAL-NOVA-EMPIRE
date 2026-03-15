import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`orders_backfill:${ip}`, 5, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }

  const ledgerLinks = await prisma.financeLedger.findMany({
    where: { orderId: { not: null } },
    select: { orderId: true, userId: true }
  })

  const map = new Map<string, string>()
  for (const row of ledgerLinks) {
    if (row.orderId && row.userId) {
      map.set(row.orderId, row.userId)
    }
  }

  let updated = 0
  for (const [orderId, userId] of map.entries()) {
    const res = await prisma.order.updateMany({
      where: { id: orderId, userId: null },
      data: { userId }
    })
    updated += res.count
  }

  return Response.json({ updated })
}
