import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { logAuditEvent } from "@/lib/server/audit"
import { z } from "zod"

const ledgerSchema = z.object({
  userId: z.string().min(2).max(80),
  type: z.string().min(2).max(40),
  amount: z.coerce.number().min(0.01).max(1_000_000_000),
  note: z.string().max(500).optional(),
  status: z.string().min(2).max(40).optional()
})

export async function GET(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  try {
    if (!(prisma as any).financeLedger) {
      return Response.json(
        { error: "Prisma client is missing FinanceLedger. Run prisma generate/db push." },
        { status: 500 }
      )
    }
    const url = new URL(req.url)
    const type = url.searchParams.get("type")
    const status = url.searchParams.get("status")
    const userId = url.searchParams.get("userId")
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200)

    const where = {
      ...(userId ? { userId } : {}),
      ...(type ? { type } : {}),
      ...(status ? { status } : {})
    }

    const entries = await prisma.financeLedger.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit
    })

    return Response.json({ entries })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load ledger."
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`finance_ledger:${ip}`, 20, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = ledgerSchema.safeParse({
      userId: typeof body.userId === "string" ? body.userId.trim() : "",
      type: typeof body.type === "string" ? body.type.trim() : "",
      amount: body.amount,
      note: typeof body.note === "string" ? body.note.trim() : undefined,
      status: typeof body.status === "string" ? body.status.trim() : undefined
    })
    if (!parsed.success) {
      return Response.json({ error: "userId, type, and amount are required" }, { status: 400 })
    }
    const { userId, type, amount, note, status } = parsed.data

    const entry = await prisma.financeLedger.create({
      data: {
        userId,
        type,
        amount,
        status: status || "manual",
        note: note || null
      }
    })

    await logAuditEvent({
      actor: auth.session.user,
      action: "finance_ledger.create",
      entityType: "FinanceLedger",
      entityId: entry.id,
      metadata: { userId, type, amount, status: status || "manual" }
    })

    return Response.json({ entry })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create entry."
    return Response.json({ error: message }, { status: 500 })
  }
}
