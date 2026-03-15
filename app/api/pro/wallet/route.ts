import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"

export async function GET(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const userId = (auth.session.user as any).id
  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200)

  const entries = await prisma.financeLedger.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit
  })

  let totalRevenue = 0
  if ((prisma as any).financeLedger) {
    const [revenueAgg, creditAgg] = await Promise.all([
      prisma.financeLedger.aggregate({
        _sum: { amount: true },
        where: { userId, type: "REVENUE" }
      }),
      prisma.financeLedger.aggregate({
        _sum: { amount: true },
        where: { userId, type: "CREDIT" }
      })
    ])
    totalRevenue = Number(revenueAgg._sum.amount || 0)
    const creditTopups = Number(creditAgg._sum.amount || 0)
    const credits = Math.round(totalRevenue / 10) + Math.round(creditTopups)
    return Response.json({ credits, entries })
  }

  const orderAgg = await prisma.order.aggregate({
    _sum: { price: true },
    where: { userId, status: { in: ["Completed", "Delivered"] } }
  })
  totalRevenue = Number(orderAgg._sum.price || 0)

  const credits = Math.round(totalRevenue / 10)

  return Response.json({ credits, entries })
}
