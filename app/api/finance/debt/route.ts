import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"

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
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))

  const totalDebt = Number(body.totalDebt || 0)
  const debtPaid = Number(body.debtPaid || 0)

  const updated = await prisma.debtProfile.upsert({
    where: { userId },
    update: { totalDebt, debtPaid },
    create: { userId, totalDebt, debtPaid }
  })

  return Response.json({ totalDebt: updated.totalDebt, debtPaid: updated.debtPaid })
}
