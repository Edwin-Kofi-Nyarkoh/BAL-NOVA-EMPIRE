import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { logAuditEvent } from "@/lib/server/audit"
import { z } from "zod"

const ledgerUpdateSchema = z.object({
  amount: z.coerce.number().min(0).max(1_000_000_000).optional(),
  status: z.string().min(2).max(40).optional(),
  note: z.string().max(500).optional()
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`finance_ledger_upd:${ip}`, 20, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const { id } = await params

  const body = await req.json().catch(() => ({}))
  const parsed = ledgerUpdateSchema.safeParse({
    amount: body.amount,
    status: typeof body.status === "string" ? body.status : undefined,
    note: typeof body.note === "string" ? body.note : undefined
  })
  if (!parsed.success) {
    return Response.json({ error: "Invalid ledger payload" }, { status: 400 })
  }
  const payload = parsed.data

  const entry = await prisma.financeLedger.update({
    where: { id },
    data: payload
  })

  await logAuditEvent({
    actor: auth.session.user,
    action: "finance_ledger.update",
    entityType: "FinanceLedger",
    entityId: entry.id,
    metadata: payload
  })

  return Response.json({ entry })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const ip = getClientIp(_req)
  const limiter = rateLimit(`finance_ledger_del:${ip}`, 10, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const { id } = await params

  await prisma.financeLedger.delete({ where: { id } })
  await logAuditEvent({
    actor: auth.session.user,
    action: "finance_ledger.delete",
    entityType: "FinanceLedger",
    entityId: id
  })
  return Response.json({ ok: true })
}
