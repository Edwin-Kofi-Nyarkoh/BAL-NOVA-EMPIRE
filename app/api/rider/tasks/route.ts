import { prisma } from "@/lib/server/prisma"
import { requireRider } from "@/lib/server/api-auth"
import { computeRiderVolume, pickActiveTaskId, rankForXp } from "@/lib/server/rider"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

type TaskInput = {
  type: string
  loc: string
  note?: string
  revenue?: number
  orderId?: string | null
}

export async function GET() {
  const auth = await requireRider()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id as string
  const tasks = await prisma.riderTask.findMany({
    where: { userId },
    orderBy: { sequence: "asc" }
  })
  return Response.json({ tasks })
}

export async function POST(req: Request) {
  const auth = await requireRider()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`rider_tasks:${ip}`, 40, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id as string

  const body = await req.json().catch(() => ({}))
  const taskSchema = z.object({
    type: z.string().min(1).max(16),
    loc: z.string().min(1).max(200),
    note: z.string().max(200).optional(),
    revenue: z.number().min(0).optional(),
    orderId: z.string().optional()
  })
  const parsed = z.array(taskSchema).safeParse(body.tasks || [])
  if (!parsed.success) {
    return Response.json({ error: "Invalid tasks", details: parsed.error.flatten() }, { status: 400 })
  }
  const tasksInput = parsed.data as TaskInput[]
  if (tasksInput.length === 0) {
    return Response.json({ error: "No tasks provided" }, { status: 400 })
  }

  const state = await prisma.riderState.upsert({
    where: { userId },
    update: {},
    create: { userId }
  })

  const last = await prisma.riderTask.findFirst({
    where: { userId },
    orderBy: { sequence: "desc" }
  })
  let sequence = last?.sequence ? last.sequence + 1 : 0

  const created = await prisma.$transaction(
    tasksInput.map((t) =>
      prisma.riderTask.create({
        data: {
          userId,
          stateId: state.id,
          orderId: t.orderId || null,
          type: t.type,
          loc: t.loc,
          note: t.note || null,
          revenue: Number(t.revenue || 0),
          sequence: sequence++
        }
      })
    )
  )

  const allTasks = await prisma.riderTask.findMany({
    where: { userId },
    orderBy: { sequence: "asc" }
  })
  const activeTaskId = pickActiveTaskId(allTasks)
  const currentVol = computeRiderVolume(allTasks)
  const rankTitle = rankForXp(state.xp)

  const updatedState = await prisma.riderState.update({
    where: { userId },
    data: {
      activeTaskId,
      currentVol,
      rankTitle,
      status: allTasks.some((t) => t.status !== "done") ? "Busy" : "Idle",
      isHoldActive: false
    }
  })

  return Response.json({ state: updatedState, tasks: created })
}
