import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { applyCors, corsHeaders } from "@/lib/server/cors"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return applyCors(auth.response)
  const user = auth.session.user as any
  const { id } = await params

  const request = await prisma.hireRequest.findUnique({ where: { id } })
  if (!request) {
    return Response.json({ error: "Hire request not found." }, { status: 404, headers: corsHeaders })
  }
  if (request.customerId !== user.id) {
    return Response.json({ error: "Forbidden." }, { status: 403, headers: corsHeaders })
  }
  if (!request.proId || !request.finalQuoteAmount) {
    return Response.json({ error: "This job is not ready for release." }, { status: 400, headers: corsHeaders })
  }

  const gross = Number(request.finalQuoteAmount || 0)
  const commission = Number((gross * 0.1).toFixed(2))
  const proNet = Number((gross - commission).toFixed(2))

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.hireRequest.update({
      where: { id },
      data: { status: "resolved" }
    })

    await tx.financeLedger.createMany({
      data: [
        {
          userId: request.proId!,
          type: "PAYOUT",
          amount: proNet,
          status: "posted",
          note: `Hire payout: ${request.title}`
        },
        {
          userId: user.id,
          type: "COMMISSION",
          amount: commission,
          status: "posted",
          note: `Bal Nova commission: ${request.title}`
        }
      ]
    })

    return next
  })

  return Response.json({ request: updated, released: proNet, commission }, { headers: corsHeaders })
}
