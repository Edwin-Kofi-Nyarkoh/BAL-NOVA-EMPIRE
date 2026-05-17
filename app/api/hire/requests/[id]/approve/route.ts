import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { initializePaystackTransaction } from "@/lib/server/paystack"
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
  if (!request.finalQuoteAmount || request.finalQuoteAmount <= 0) {
    return Response.json({ error: "This job has no final quote yet." }, { status: 400, headers: corsHeaders })
  }

  const amount = Number(request.finalQuoteAmount.toFixed(2))
  const txRef = `BN-HIREFINAL-${Date.now()}-${user.id.slice(0, 6)}`
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"

  const payment = await prisma.paymentIntent.create({
    data: {
      userId: user.id,
      txRef,
      amount,
      currency: "GHS",
      status: "pending",
      provider: "paystack",
      channel: "hire_final",
      items: {
        type: "HIRE_FINAL",
        hireRequestId: request.id,
        title: request.title,
        proId: request.proId
      }
    }
  })

  await prisma.hireRequest.update({
    where: { id },
    data: { finalPaymentId: payment.id, status: "awaiting_final_payment" }
  })

  try {
    const response = await initializePaystackTransaction({
      email: String(user.email || ""),
      amount: Math.round(amount * 100),
      currency: "GHS",
      reference: txRef,
      callback_url: `${baseUrl}/payment/callback`,
      metadata: {
        source: "hire_final",
        hireRequestId: request.id,
        title: request.title
      }
    })
    const link = response?.data?.authorization_url
    if (!link) throw new Error("Missing payment link")
    await prisma.paymentIntent.update({ where: { id: payment.id }, data: { checkoutUrl: link } })
    return Response.json({ link, txRef }, { headers: corsHeaders })
  } catch (error) {
    console.error("hire.approve.payment.error", error)
    return Response.json(
      { error: "Final quote saved, but payment checkout is not configured yet.", paymentId: payment.id },
      { status: 202, headers: corsHeaders }
    )
  }
}
