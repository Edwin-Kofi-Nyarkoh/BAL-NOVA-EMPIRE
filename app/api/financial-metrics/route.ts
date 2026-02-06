import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"

const TAX_RATE = 0.18
const LOGISTICS_RATE = 0.45
const COMMISSIONS_RATE = 0.12

export async function GET(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const userId = (auth.session.user as any).id
  const url = new URL(req.url)
  const range = url.searchParams.get("range") || "30d"
  const now = Date.now()
  const rangeDays = range === "7d" ? 7 : range === "90d" ? 90 : range === "all" ? null : 30
  const startDate = rangeDays ? new Date(now - rangeDays * 24 * 60 * 60 * 1000) : null

  const realizedStatuses = ["Completed", "Delivered"]
  const escrowStatus = "Delivered"
  const escrowWindowStart = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)

  const [ledgerRevenueAgg, ledgerEscrowAgg, debtProfile] = await Promise.all([
    prisma.financeLedger.aggregate({
      _sum: { amount: true },
      where: {
        userId,
        type: "REVENUE",
        createdAt: startDate ? { gte: startDate } : undefined
      }
    }),
    prisma.financeLedger.aggregate({
      _sum: { amount: true },
      where: {
        userId,
        type: "ESCROW",
        createdAt: { gte: escrowWindowStart }
      }
    }),
    prisma.debtProfile.findUnique({ where: { userId } })
  ])

  let totalRevenue = Number(ledgerRevenueAgg._sum.amount || 0)
  let escrow = Number(ledgerEscrowAgg._sum.amount || 0)

  if (totalRevenue === 0) {
    const realizedAgg = await prisma.order.aggregate({
      _sum: { price: true },
      where: {
        status: { in: realizedStatuses },
        createdAt: startDate ? { gte: startDate } : undefined
      }
    })
    totalRevenue = Number(realizedAgg._sum.price || 0)
  }

  if (escrow === 0) {
    const escrowAgg = await prisma.order.aggregate({
      _sum: { price: true },
      where: { status: escrowStatus, createdAt: { gte: escrowWindowStart } }
    })
    escrow = Number(escrowAgg._sum.price || 0)
  }

  const taxVault = totalRevenue * TAX_RATE
  const netRevenue = totalRevenue - taxVault
  const logisticsRevenue = totalRevenue * LOGISTICS_RATE
  const commissionsRevenue = totalRevenue * COMMISSIONS_RATE

  return Response.json({
    totalRevenue,
    escrow,
    taxVault,
    netRevenue,
    logisticsRevenue,
    commissionsRevenue,
    debtPaid: debtProfile?.debtPaid || 0,
    totalDebt: debtProfile?.totalDebt || 0
  })
}
