import { PrismaClient } from "../../generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import type { RouteHandler } from "../api/types"
import { json } from "../api/utils"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  log: ["error"]
})

const getOverview: RouteHandler = async ({ res, user }) => {
  if (!user) return json(res, 401, { error: "Unauthorized" })
  if (user.role !== "admin") return json(res, 403, { error: "Forbidden" })

  try {
    const [users, orders, payments, inventoryItems] = await Promise.all([
      prisma.user.count(),
      prisma.order.count(),
      prisma.paymentIntent.count(),
      prisma.inventoryItem.count()
    ])

    return json(res, 200, {
      overview: {
        users,
        orders,
        payments,
        inventoryItems
      }
    })
  } catch {
    return json(res, 500, { error: "Unable to load analytics overview." })
  }
}

export const analyticsRoutes: Record<string, RouteHandler> = {
  "GET /analytics/overview": getOverview
}
