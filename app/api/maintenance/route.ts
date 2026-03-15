import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { logAuditEvent } from "@/lib/server/audit"
import { z } from "zod"

const maintenanceSchema = z.object({
  category: z.string().min(2).max(80),
  assetId: z.string().max(80).optional(),
  cost: z.coerce.number().min(0.01).max(1_000_000_000),
  lockInWorkshop: z.boolean().optional()
})

export async function GET(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200)
  const userId = url.searchParams.get("userId") || (auth.session.user as any).id

  const logs = await prisma.maintenanceLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit
  })

  return Response.json({ logs })
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`maintenance_post:${ip}`, 20, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const parsed = maintenanceSchema.safeParse({
    category: typeof body.category === "string" ? body.category.trim() : "",
    assetId: typeof body.assetId === "string" ? body.assetId.trim() : undefined,
    cost: body.cost,
    lockInWorkshop: typeof body.lockInWorkshop === "boolean" ? body.lockInWorkshop : undefined
  })
  if (!parsed.success) {
    return Response.json({ error: "Invalid maintenance payload" }, { status: 400 })
  }
  const { category, assetId, cost, lockInWorkshop } = parsed.data

  const log = await prisma.maintenanceLog.create({
    data: {
      userId,
      category,
      assetId: assetId || null,
      cost,
      lockInWorkshop: !!lockInWorkshop
    }
  })

  await logAuditEvent({
    actor: auth.session.user,
    action: "maintenance.create",
    entityType: "MaintenanceLog",
    entityId: log.id,
    metadata: { category, assetId: assetId || null, cost, lockInWorkshop: !!lockInWorkshop }
  })

  return Response.json({ log })
}
