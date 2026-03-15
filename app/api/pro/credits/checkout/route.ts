import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { initializePaystackTransaction } from "@/lib/server/paystack"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const creditsSchema = z.object({
  amount: z.coerce.number().min(1).max(100000)
})

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`pro_credits:${ip}`, 12, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const user = auth.session.user as any

  const body = await req.json().catch(() => ({}))
  const parsed = creditsSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid amount." }, { status: 400 })
  }
  const amount = parsed.data.amount

  if (!user?.email) {
    return Response.json({ error: "Missing account email." }, { status: 400 })
  }

  const txRef = `BN-CR-${Date.now()}-${user.id.slice(0, 6)}`
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"

  const payment = await prisma.paymentIntent.create({
    data: {
      userId: user.id,
      txRef,
      amount,
      currency: "GHS",
      status: "pending",
      provider: "paystack",
      channel: "pro_wallet",
      items: { type: "PRO_CREDITS", credits: Math.round(amount) }
    }
  })

  const payload = {
    email: String(user.email || ""),
    amount: Math.round(amount * 100),
    currency: "GHS",
    reference: txRef,
    callback_url: `${baseUrl}/payment/callback`,
    metadata: {
      source: "pro_wallet",
      type: "PRO_CREDITS",
      credits: Math.round(amount)
    }
  }

  const response = await initializePaystackTransaction(payload)
  const link = response?.data?.authorization_url
  if (!link) {
    await prisma.paymentIntent.update({
      where: { id: payment.id },
      data: { status: "failed" }
    })
    return Response.json({ error: "Unable to start payment." }, { status: 500 })
  }

  await prisma.paymentIntent.update({
    where: { id: payment.id },
    data: { checkoutUrl: link }
  })

  return Response.json({ link, txRef })
}
