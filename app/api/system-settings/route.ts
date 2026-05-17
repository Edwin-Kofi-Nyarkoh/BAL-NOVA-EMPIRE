import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { logAuditEvent } from "@/lib/server/audit"
import { z } from "zod"

const settingsSchema = z.object({
  dispatchRadiusKm: z.coerce.number().min(0.1).max(500).optional(),
  dispatchPolygon: z.string().max(4000).optional(),
  mapProvider: z.string().max(40).optional()
})

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const settings = await prisma.systemSettings.findFirst()
  return Response.json({ settings })
}

export async function PUT(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`system_settings:${ip}`, 20, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const body = await req.json().catch(() => ({}))
  const parsed = settingsSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid settings payload" }, { status: 400 })
  }
  const { dispatchRadiusKm, dispatchPolygon, mapProvider } = parsed.data

  const existing = await prisma.systemSettings.findFirst()
  const settings = existing
    ? await prisma.systemSettings.update({
        where: { id: existing.id },
        data: { dispatchRadiusKm, dispatchPolygon, mapProvider }
      })
    : await prisma.systemSettings.create({
        data: { dispatchRadiusKm, dispatchPolygon, mapProvider }
      })

  await logAuditEvent({
    actor: auth.session.user,
    action: "system_settings.update",
    entityType: "SystemSettings",
    entityId: settings.id,
    metadata: { dispatchRadiusKm, dispatchPolygon, mapProvider }
  })

  return Response.json({ settings })
}
