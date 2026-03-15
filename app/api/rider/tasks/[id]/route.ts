import { prisma } from "@/lib/server/prisma"
import { requireRider } from "@/lib/server/api-auth"
import { clampReputation, computeRiderVolume, pickActiveTaskId, rankForXp } from "@/lib/server/rider"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

type ActionBody = {
  action?: "activate" | "complete"
  status?: string
}

const taskActionSchema = z.object({
  action: z.enum(["activate", "complete"]).optional(),
  status: z.string().min(2).max(40).optional()
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRider()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`rider_task_action:${ip}`, 60, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id as string
  const { id } = await params
  const bodyRaw = (await req.json().catch(() => ({}))) as ActionBody
  const parsed = taskActionSchema.safeParse(bodyRaw)
  if (!parsed.success) {
    return Response.json({ error: "Invalid task action" }, { status: 400 })
  }
  const body = parsed.data

  const task = await prisma.riderTask.findFirst({
    where: { id, userId }
  })
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 })

  const state = await prisma.riderState.upsert({
    where: { userId },
    update: {},
    create: { userId }
  })

  if (body.action === "activate") {
    const updatedTask = await prisma.riderTask.update({
      where: { id },
      data: { status: task.status === "done" ? "done" : "active" }
    })
    const updatedState = await prisma.riderState.update({
      where: { userId },
      data: {
        activeTaskId: updatedTask.id,
        status: "Busy",
        isHoldActive: false
      }
    })
    return Response.json({ state: updatedState, task: updatedTask })
  }

  if (body.action === "complete") {
    const updatedTask = await prisma.riderTask.update({
      where: { id },
      data: { status: "done" }
    })
    const allTasks = await prisma.riderTask.findMany({
      where: { userId },
      orderBy: { sequence: "asc" }
    })
    const revenue = updatedTask.revenue || (updatedTask.type === "pickup" ? 25 : 15)
    const nextActive = pickActiveTaskId(allTasks)
    const currentVol = computeRiderVolume(allTasks)
    const nextXp = state.xp + 50
    const nextRank = rankForXp(nextXp)
    const nextReputation = clampReputation(state.reputation + 1)

    const updatedState = await prisma.riderState.update({
      where: { userId },
      data: {
        pendingCash: state.pendingCash + revenue,
        xp: nextXp,
        streak: state.streak + 1,
        reputation: nextReputation,
        rankTitle: nextRank,
        lastKnownLocation: updatedTask.loc,
        currentVol,
        activeTaskId: nextActive,
        status: state.status === "Offline" ? "Offline" : allTasks.some((t) => t.status !== "done") ? "Busy" : "Idle",
        isHoldActive: false
      }
    })

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        actorEmail: (auth.session.user as any)?.email || null,
        action: "RIDER_TASK_COMPLETED",
        entityType: "rider_task",
        entityId: updatedTask.id,
        metadata: {
          type: updatedTask.type,
          loc: updatedTask.loc,
          orderId: updatedTask.orderId || null
        }
      }
    })

    if (updatedTask.orderId) {
      if (updatedTask.type === "pickup") {
        await prisma.order.update({
          where: { id: updatedTask.orderId },
          data: { status: "In-Transit", pickedUpAt: new Date() }
        })
        await prisma.auditLog.create({
          data: {
            actorId: userId,
            actorEmail: (auth.session.user as any)?.email || null,
            action: "ORDER_PICKED_UP",
            entityType: "order",
            entityId: updatedTask.orderId,
            metadata: {
              riderTaskId: updatedTask.id,
              loc: updatedTask.loc
            }
          }
        })
      }
      if (updatedTask.type === "drop") {
        await prisma.order.update({
          where: { id: updatedTask.orderId },
          data: { status: "Delivered", deliveredAt: new Date() }
        })
        await prisma.auditLog.create({
          data: {
            actorId: userId,
            actorEmail: (auth.session.user as any)?.email || null,
            action: "ORDER_DELIVERED",
            entityType: "order",
            entityId: updatedTask.orderId,
            metadata: {
              riderTaskId: updatedTask.id,
              loc: updatedTask.loc
            }
          }
        })
      }
    }
    return Response.json({ state: updatedState, task: updatedTask, tasks: allTasks })
  }

  if (body.status) {
    const updatedTask = await prisma.riderTask.update({
      where: { id },
      data: { status: body.status }
    })
    return Response.json({ task: updatedTask })
  }

  return Response.json({ error: "Unsupported action" }, { status: 400 })
}
