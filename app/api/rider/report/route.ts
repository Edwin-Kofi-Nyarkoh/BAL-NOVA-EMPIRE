import { prisma } from "@/lib/server/prisma"
import { requireRider } from "@/lib/server/api-auth"
import { z } from "zod"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"

type ReportBody = {
  taskId?: string
  category?: string
  detail?: string
}

export async function POST(req: Request) {
  const auth = await requireRider()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`rider_report:${ip}`, 20, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests" }, { status: 429 })
  }
  const body = (await req.json().catch(() => ({}))) as ReportBody
  const schema = z.object({
    taskId: z.string().optional(),
    category: z.string().min(1).max(64),
    detail: z.string().max(200).optional()
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid report" }, { status: 400 })
  }

  await prisma.auditLog.create({
    data: {
      actorId: (auth.session.user as any)?.id || null,
      actorEmail: auth.session.user?.email || null,
      action: "RIDER_REPORT",
      entityType: "rider_task",
      entityId: parsed.data.taskId || null,
      metadata: {
        category: parsed.data.category,
        detail: parsed.data.detail || null
      }
    }
  })

  return Response.json({ ok: true })
}
