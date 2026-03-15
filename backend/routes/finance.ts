import { PrismaClient } from "../../generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import type { RouteHandler } from "../api/types"
import { json } from "../api/utils"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  log: ["error"]
})

const getFinanceSummary: RouteHandler = async ({ res, user }) => {
  if (!user) return json(res, 401, { error: "Unauthorized" })

  const isAdmin = user.role === "admin"
  const where = isAdmin ? {} : { userId: user.id }

  try {
    const [paymentTotal, ledgerTotal, ledgerCount] = await Promise.all([
      prisma.paymentIntent.aggregate({ _sum: { amount: true }, where }),
      prisma.financeLedger.aggregate({ _sum: { amount: true }, where }),
      prisma.financeLedger.count({ where })
    ])

    return json(res, 200, {
      summary: {
        paymentTotal: paymentTotal._sum.amount || 0,
        ledgerTotal: ledgerTotal._sum.amount || 0,
        ledgerEntries: ledgerCount,
        scope: isAdmin ? "all" : "self"
      }
    })
  } catch {
    return json(res, 500, { error: "Unable to load finance summary." })
  }
}

export const financeRoutes: Record<string, RouteHandler> = {
  "GET /finance/summary": getFinanceSummary
}
