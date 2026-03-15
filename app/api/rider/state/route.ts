import { prisma } from "@/lib/server/prisma"
import { requireRider } from "@/lib/server/api-auth"
import { computeRiderVolume, pickActiveTaskId, rankForXp } from "@/lib/server/rider"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

type UpdateBody = {
  status?: string
  currentSector?: string
  isHoldActive?: boolean
  action?: "end_shift" | "go_online" | "go_offline"
}

const riderStateSchema = z.object({
  status: z.string().min(2).max(40).optional(),
  currentSector: z.string().max(120).optional(),
  isHoldActive: z.boolean().optional(),
  action: z.enum(["end_shift", "go_online", "go_offline"]).optional()
})

export async function GET() {
  const auth = await requireRider()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id as string
  const state = await prisma.riderState.upsert({
    where: { userId },
    update: {},
    create: { userId }
  })
  return Response.json({ state })
}

export async function PATCH(req: Request) {
  const auth = await requireRider()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`rider_state:${ip}`, 60, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id as string
  const bodyRaw = (await req.json().catch(() => ({}))) as UpdateBody
  const parsed = riderStateSchema.safeParse(bodyRaw)
  if (!parsed.success) {
    return Response.json({ error: "Invalid rider state payload" }, { status: 400 })
  }
  const body = parsed.data

  if (body.action === "end_shift") {
    await prisma.riderTask.deleteMany({ where: { userId } })
    const updated = await prisma.riderState.update({
      where: { userId },
      data: {
        status: "Offline",
        pendingCash: 0,
        xp: 0,
        streak: 0,
        currentVol: 0,
        activeTaskId: null,
        lastKnownLocation: null,
        isHoldActive: false,
        rankTitle: "NOVICE"
      }
    })
    return Response.json({ state: updated })
  }

  if (body.action === "go_offline") {
    const updated = await prisma.riderState.update({
      where: { userId },
      data: { status: "Offline" }
    })
    return Response.json({ state: updated })
  }

  if (body.action === "go_online") {
    const active = await prisma.riderTask.findMany({
      where: { userId, status: { not: "done" } }
    })
    const updated = await prisma.riderState.update({
      where: { userId },
      data: { status: active.length > 0 ? "Busy" : "Idle" }
    })
    return Response.json({ state: updated })
  }

  const tasks = await prisma.riderTask.findMany({
    where: { userId },
    orderBy: { sequence: "asc" }
  })
  const data: Record<string, any> = {}
  if (body.status) data.status = body.status
  if (body.currentSector) data.currentSector = body.currentSector
  if (typeof body.isHoldActive === "boolean") data.isHoldActive = body.isHoldActive
  data.activeTaskId = pickActiveTaskId(tasks)
  data.currentVol = computeRiderVolume(tasks)

  const state = await prisma.riderState.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data, rankTitle: rankForXp(0) }
  })

  return Response.json({ state })
}
