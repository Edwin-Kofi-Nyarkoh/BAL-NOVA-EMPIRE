import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { logAuditEvent } from "@/lib/server/audit"
import { z } from "zod"

const rateCardSchema = z.object({
  fx: z.coerce.number().min(0).max(1_000_000).optional(),
  air: z.coerce.number().min(0).max(1_000_000).optional(),
  sea: z.coerce.number().min(0).max(1_000_000).optional(),
  roadKm: z.coerce.number().min(0).max(1_000_000).optional(),
  roadBase: z.coerce.number().min(0).max(1_000_000).optional(),
  border: z.coerce.number().min(0).max(1_000_000).optional(),
  local: z.coerce.number().min(0).max(1_000_000).optional()
})

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!(prisma as any).rateCard) {
    return Response.json(
      { error: "Prisma client is missing RateCard. Run prisma generate/db push." },
      { status: 500 }
    )
  }
  const userId = (auth.session.user as any).id
  const card = await prisma.rateCard.findUnique({ where: { userId } })
  return Response.json({ card })
}

export async function PUT(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`rate_card:${ip}`, 20, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  if (!(prisma as any).rateCard) {
    return Response.json(
      { error: "Prisma client is missing RateCard. Run prisma generate/db push." },
      { status: 500 }
    )
  }
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const parsed = rateCardSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid rate card payload" }, { status: 400 })
  }
  const data = parsed.data

  const card = await prisma.rateCard.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data }
  })

  await logAuditEvent({
    actor: auth.session.user,
    action: "rate_card.update",
    entityType: "RateCard",
    entityId: card.id,
    metadata: data
  })

  return Response.json({ card })
}
