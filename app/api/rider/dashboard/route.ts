import { prisma } from "@/lib/server/prisma"
import { requireRider } from "@/lib/server/api-auth"
import { computeRiderVolume, pickActiveTaskId, rankForXp } from "@/lib/server/rider"

function defaultSector() {
  return "SPINTEX_PRIME"
}

export async function GET() {
  const auth = await requireRider()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id as string

  const state = await prisma.riderState.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      status: "Idle",
      currentSector: defaultSector(),
      currentVol: 0,
      pendingCash: 0,
      xp: 0,
      streak: 0,
      reputation: 100,
      rankTitle: "NOVICE"
    }
  })

  let tasks = await prisma.riderTask.findMany({
    where: { userId },
    orderBy: { sequence: "asc" }
  })

  const assignedOrders = await prisma.order.findMany({
    where: { riderId: userId, status: { not: "Delivered" } },
    orderBy: { createdAt: "desc" }
  })

  const deliveredOrders = await prisma.order.findMany({
    where: { riderId: userId, status: "Delivered" },
    select: { id: true }
  })
  if (deliveredOrders.length > 0) {
    await prisma.riderTask.updateMany({
      where: { userId, orderId: { in: deliveredOrders.map((o) => o.id) }, status: { not: "done" } },
      data: { status: "done" }
    })
  }

  if (assignedOrders.length > 0) {
    const existingTasks = await prisma.riderTask.findMany({
      where: { userId, orderId: { in: assignedOrders.map((o) => o.id) } }
    })
    const existingOrderIds = new Set(existingTasks.map((t) => t.orderId).filter(Boolean) as string[])
    const last = await prisma.riderTask.findFirst({
      where: { userId },
      orderBy: { sequence: "desc" }
    })
    let sequence = last?.sequence ? last.sequence + 1 : 0
    const toCreate = assignedOrders.filter((o) => !existingOrderIds.has(o.id))
    if (toCreate.length > 0) {
      await prisma.$transaction(
        toCreate.flatMap((order) => [
          prisma.riderTask.create({
            data: {
              userId,
              stateId: state.id,
              orderId: order.id,
              type: "pickup",
              loc: order.origin || "Warehouse",
              note: "Collect item",
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
              note: "Deliver to customer",
              revenue: Math.max(12, Math.round(order.price * 0.05)),
              sequence: sequence++
            }
          })
        ])
      )
    }
  }

  tasks = await prisma.riderTask.findMany({
    where: { userId },
    orderBy: { sequence: "asc" }
  })

  const activeTaskId = state.activeTaskId || pickActiveTaskId(tasks)
  const currentVol = computeRiderVolume(tasks)
  const rankTitle = rankForXp(state.xp)

  const hasActive = tasks.some((t) => t.status !== "done")
  const updatedState =
    activeTaskId !== state.activeTaskId ||
    currentVol !== state.currentVol ||
    rankTitle !== state.rankTitle ||
    (hasActive && state.isHoldActive)
      ? await prisma.riderState.update({
          where: { userId },
          data: {
            activeTaskId,
            currentVol,
            rankTitle,
            status: state.status === "Offline" ? "Offline" : hasActive ? "Busy" : "Idle",
            isHoldActive: hasActive ? false : state.isHoldActive
          }
        })
      : state

  return Response.json({ state: updatedState, tasks })
}
