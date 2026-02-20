import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import { notifyPaymentReceipt } from "@/lib/server/notifications"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const ip = getClientIp(_)
  const limiter = rateLimit(`pay_receipt:${ip}`, 10, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const { id } = await params

  const payment = await prisma.paymentIntent.findUnique({
    where: { id },
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
