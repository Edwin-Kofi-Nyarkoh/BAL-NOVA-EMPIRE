import { prisma } from "@/lib/server/prisma"
import { requireRider } from "@/lib/server/api-auth"
import { computeRiderVolume, pickActiveTaskId, rankForXp } from "@/lib/server/rider"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"

export async function POST(req: Request) {
  const auth = await requireRider()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`rider_vacuum:${ip}`, 10, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id as string

  const state = await prisma.riderState.upsert({
    where: { userId },
    update: {},
    create: { userId }
  })

  const orders = await prisma.order.findMany({
    where: { status: { not: "Delivered" }, riderId: null },
    orderBy: { createdAt: "desc" },
    take: 2
  })

  if (orders.length === 0) {
    return Response.json({ error: "No dispatches available" }, { status: 404 })
  }

  const last = await prisma.riderTask.findFirst({
    where: { userId },
    orderBy: { sequence: "desc" }
  })
  let sequence = last?.sequence ? last.sequence + 1 : 0

  const existing = await prisma.riderTask.findMany({
    where: { userId, orderId: { in: orders.map((o) => o.id) } }
  })
  const existingIds = new Set(existing.map((t) => t.orderId).filter(Boolean) as string[])
  const toAssign = orders.filter((o) => !existingIds.has(o.id))
  if (toAssign.length === 0) {
    return Response.json({ error: "No new dispatches available" }, { status: 404 })
  }

  await prisma.$transaction(
    toAssign.flatMap((order) => [
      prisma.order.update({
        where: { id: order.id },
        data: { rider: { connect: { id: userId } }, status: order.status === "Pending" ? "Assigned" : order.status }
      }),
      prisma.riderTask.create({
        data: {
          userId,
          stateId: state.id,
          orderId: order.id,
          type: "pickup",
          loc: order.origin || "Warehouse",
          note: "Priority pickup",
          revenue: Math.max(20, Math.round(order.price * 0.08)),
          sequence: sequence++
        }
      }),
      prisma.riderTask.create({
        data: {
          userId,
          stateId: state.id,
          orderId: order.id,
          type: "drop",
          loc: order.item || "Dropoff",
          note: "Priority drop",
          revenue: Math.max(12, Math.round(order.price * 0.05)),
          sequence: sequence++
        }
      })
    ])
  )

  const tasks = await prisma.riderTask.findMany({
    where: { userId },
    orderBy: { sequence: "asc" }
  })
  const createdTasks = tasks.filter((t) => t.orderId && toAssign.some((o) => o.id === t.orderId))
  const activeTaskId = pickActiveTaskId(tasks)
  const currentVol = computeRiderVolume(tasks)
  const rankTitle = rankForXp(state.xp)

  const updatedState = await prisma.riderState.update({
    where: { userId },
    data: {
      activeTaskId,
      currentVol,
      rankTitle,
      status: tasks.some((t) => t.status !== "done") ? "Busy" : "Idle",
      isHoldActive: false
    }
  })

  return Response.json({ state: updatedState, tasks: createdTasks })
}
