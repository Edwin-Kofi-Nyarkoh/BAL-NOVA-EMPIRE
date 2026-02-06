import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import { notifyPaymentReceipt } from "@/lib/server/notifications"

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const payment = await prisma.paymentIntent.findUnique({
    where: { id: params.id },
    include: { user: true }
  })

  if (!payment || !payment.user?.email) {
    return Response.json({ error: "Payment or user not found" }, { status: 404 })
  }

  await notifyPaymentReceipt({
    email: payment.user.email,
    name: payment.user.name,
    amount: Number(payment.amount || 0),
    currency: payment.currency,
    reference: payment.txRef
  })

  return Response.json({ ok: true })
}
