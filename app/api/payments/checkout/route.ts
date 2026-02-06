import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { initializePaystackTransaction } from "@/lib/server/paystack"
import { applyCors, corsHeaders } from "@/lib/server/cors"

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return applyCors(auth.response)
  const user = auth.session.user as any
  let paymentId: string | null = null
  try {
    const body = await req.json().catch(() => ({}))
    const source = String(body.source || "storefront")
    const deliveryFee = Math.max(0, Number(body.deliveryFee || 0))

    if (!user?.email) {
      return Response.json({ error: "Missing account email." }, { status: 400, headers: corsHeaders })
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: { items: true }
    })

    if (!cart || cart.items.length === 0) {
      return Response.json({ error: "Cart is empty" }, { status: 400, headers: corsHeaders })
    }

    const items = cart.items.map((i) => ({
      productId: i.productId || null,
      name: i.name,
      price: i.price,
      qty: i.qty
    }))
    const itemsTotal = items.reduce((sum, i) => sum + i.price * i.qty, 0)
    const total = Number((itemsTotal + deliveryFee).toFixed(2))

    if (total <= 0) {
      return Response.json({ error: "Invalid payment amount." }, { status: 400, headers: corsHeaders })
    }

    const txRef = `BN-${Date.now()}-${user.id.slice(0, 6)}`
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"

    const payment = await prisma.paymentIntent.create({
      data: {
        userId: user.id,
        txRef,
        amount: total,
        currency: "GHS",
        status: "pending",
        provider: "paystack",
        channel: source,
        items: { items, deliveryFee }
      }
    })
    paymentId = payment.id

    const payload = {
      email: String(user.email || ""),
      amount: Math.round(total * 100),
      currency: "GHS",
      reference: txRef,
      callback_url: `${baseUrl}/payment/callback`,
      metadata: {
        source,
        deliveryFee,
        items
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
    console.error("payments.checkout.error", error)
    if (paymentId) {
      await prisma.paymentIntent.update({
        where: { id: paymentId },
        data: { status: "failed" }
      }).catch(() => {})
    }
    return Response.json({ error: "Unable to start payment." }, { status: 500, headers: corsHeaders })
  }
}
