import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

type AdminBody =
  | { action: "assign"; orderId: string; riderId: string }
  | { action: "clear_tasks"; riderId: string }

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const riders = await prisma.user.findMany({
    where: { role: "rider" },
    select: {
      id: true,
      name: true,
      email: true,
      riderState: true,
      riderTasks: {
        where: { status: { not: "done" } },
        orderBy: { sequence: "asc" }
      }
    }
  })

  return Response.json({ riders })
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`rider_admin:${ip}`, 20, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const body = (await req.json().catch(() => ({}))) as AdminBody

  if (body.action === "assign") {
    const schema = z.object({
      action: z.literal("assign"),
      orderId: z.string().min(1),
      riderId: z.string().min(1)
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "orderId and riderId required" }, { status: 400 })
    }
    const order = await prisma.order.update({
      where: { id: parsed.data.orderId },
      data: { rider: { connect: { id: parsed.data.riderId } }, status: "Assigned" }
    })
    return Response.json({ order })
  }

  if (body.action === "clear_tasks") {
    const schema = z.object({
      action: z.literal("clear_tasks"),
      riderId: z.string().min(1)
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "riderId required" }, { status: 400 })
    }
    await prisma.riderTask.deleteMany({ where: { userId: parsed.data.riderId } })
    await prisma.riderState.updateMany({
      where: { userId: parsed.data.riderId },
      data: { activeTaskId: null, status: "Idle", currentVol: 0 }
    })
    return Response.json({ ok: true })
  }

  return Response.json({ error: "Invalid action" }, { status: 400 })
}
