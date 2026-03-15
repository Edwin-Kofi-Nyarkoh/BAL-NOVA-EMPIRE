import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const debtSchema = z.object({
  totalDebt: z.coerce.number().min(0).max(1_000_000_000),
  debtPaid: z.coerce.number().min(0).max(1_000_000_000)
})

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id

  const debt = await prisma.debtProfile.findUnique({ where: { userId } })
  return Response.json({
    totalDebt: debt?.totalDebt || 0,
    debtPaid: debt?.debtPaid || 0
  })
}

export async function PUT(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`debt_put:${ip}`, 30, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const parsed = debtSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid debt payload" }, { status: 400 })
  }
  const { totalDebt, debtPaid } = parsed.data

  const updated = await prisma.debtProfile.upsert({
    where: { userId },
    update: { totalDebt, debtPaid },
    create: { userId, totalDebt, debtPaid }
  })

  return Response.json({ totalDebt: updated.totalDebt, debtPaid: updated.debtPaid })
}
