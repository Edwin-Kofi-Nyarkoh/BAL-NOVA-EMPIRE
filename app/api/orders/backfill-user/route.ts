import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"

export async function POST() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

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
