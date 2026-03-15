import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { initializePaystackTransaction } from "@/lib/server/paystack"
import { applyCors, corsHeaders } from "@/lib/server/cors"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const checkoutOrderSchema = z.object({
  orderId: z.string().min(6).max(80)
})

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return applyCors(auth.response)
  const ip = getClientIp(req)
  const limiter = rateLimit(`pay_checkout_order:${ip}`, 12, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429, headers: corsHeaders })
  }
  const user = auth.session.user as any
  let paymentId: string | null = null
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = checkoutOrderSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Missing orderId" }, { status: 400, headers: corsHeaders })
    }
    const orderId = parsed.data.orderId
    if (!user?.email) {
      return Response.json({ error: "Missing account email." }, { status: 400, headers: corsHeaders })
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: user.id }
    })
    if (!order) {
      return Response.json({ error: "Order not found" }, { status: 404, headers: corsHeaders })
    }
    if (order.status === "Paid") {
      return Response.json({ error: "Order already paid" }, { status: 400, headers: corsHeaders })
    }

    const txRef = `BN-ORD-${Date.now()}-${order.id.slice(0, 6)}`
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
    const amount = Number(order.price || 0)
    if (amount <= 0) {
      return Response.json({ error: "Invalid payment amount." }, { status: 400, headers: corsHeaders })
    }

    const payment = await prisma.paymentIntent.create({
      data: {
        userId: user.id,
        txRef,
        amount,
        currency: "GHS",
        status: "pending",
        provider: "paystack",
        channel: "order",
        items: { items: [{ name: order.item, price: order.price, qty: 1 }], orderId }
      }
    })
    paymentId = payment.id

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentId: payment.id, status: "Pending Payment" }
    })

    const payload = {
      email: String(user.email || ""),
      amount: Math.round(amount * 100),
      currency: "GHS",
      reference: txRef,
      callback_url: `${baseUrl}/payment/callback`,
      metadata: {
        source: "order",
        orderId: order.id
      }
    }

    const response = await initializePaystackTransaction(payload)
    const link = response?.data?.authorization_url
    if (!link) {
      throw new Error("Missing payment link")
    }

    await prisma.paymentIntent.update({
      where: { id: payment.id },
      data: { checkoutUrl: link }
    })

    return Response.json({ link, txRef }, { headers: corsHeaders })
  } catch (error) {
    console.error("payments.checkoutOrder.error", error)
    if (paymentId) {
      await prisma.paymentIntent.update({
        where: { id: paymentId },
        data: { status: "failed" }
      }).catch(() => {})
    }
    return Response.json({ error: "Unable to start payment." }, { status: 500, headers: corsHeaders })
  }
}
