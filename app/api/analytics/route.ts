import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [
    inventoryCount,
    lowInventoryCount,
    ordersCount,
    chatsCount,
    usersCount,
    adminsCount,
    orderAgg,
    orders24h,
    chats24h,
    users24h
  ] = await Promise.all([
    prisma.inventoryItem.count(),
    prisma.inventoryItem.count({ where: { baseStock: { lte: 5 } } }),
    prisma.order.count(),
    prisma.chat.count(),
    prisma.user.count(),
    prisma.user.count({ where: { role: "admin" } }),
    prisma.order.aggregate({ _sum: { price: true } }),
    prisma.order.count({ where: { createdAt: { gte: since } } }),
    prisma.chat.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count({ where: { createdAt: { gte: since } } })
  ])

  return Response.json({
    totals: {
      inventoryCount,
      lowInventoryCount,
      ordersCount,
      chatsCount,
      usersCount,
      adminsCount,
      revenue: Number(orderAgg._sum.price || 0)
    },
    last24h: {
      orders: orders24h,
      chats: chats24h,
      newUsers: users24h
    }
  })
}
