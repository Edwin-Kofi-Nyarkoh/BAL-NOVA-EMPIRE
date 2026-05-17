import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { initializePaystackTransaction } from "@/lib/server/paystack"
import { applyCors, corsHeaders } from "@/lib/server/cors"
import { z } from "zod"

const hireRequestSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(10).max(4000),
  polishedDescription: z.string().trim().max(4000).optional(),
  trade: z.string().trim().max(100).optional(),
  urgency: z.enum(["standard", "panic"]).default("standard"),
  proId: z.string().trim().min(1).optional(),
  diagnosticFee: z.coerce.number().min(0).max(100000).optional(),
  location: z.string().trim().max(220).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional()
})

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return applyCors(auth.response)
  const user = auth.session.user as any
  const role = String(user.role || "user")

  const where =
    role === "pro"
      ? { OR: [{ proId: user.id }, { proId: null, status: { in: ["open", "diagnostic_paid"] } }] }
      : { customerId: user.id }

  const requests = await prisma.hireRequest.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, email: true } },
      pro: { select: { id: true, name: true, email: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 80
  })

  return Response.json({ requests }, { headers: corsHeaders })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return applyCors(auth.response)
  const user = auth.session.user as any
  const body = await req.json().catch(() => ({}))
  const parsed = hireRequestSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid hire request.", details: parsed.error.flatten() }, { status: 400, headers: corsHeaders })
  }

  const input = parsed.data
  const pro = input.proId
    ? await prisma.user.findFirst({
        where: { id: input.proId, role: "pro", approvalStatus: "approved" },
        include: { artisanOnboarding: true }
      })
    : null

  if (input.proId && !pro) {
    return Response.json({ error: "Selected pro is not available." }, { status: 404, headers: corsHeaders })
  }

  const diagnosticFee = Number(
    input.diagnosticFee ?? pro?.artisanOnboarding?.diagnosticFee ?? (input.urgency === "panic" ? 50 : 50)
  )
  const surgeFee = input.urgency === "panic" ? 25 : 0
  const paymentTotal = Number((diagnosticFee + surgeFee).toFixed(2))
  const status = paymentTotal > 0 ? "awaiting_diagnostic_payment" : "open"

  const request = await prisma.hireRequest.create({
    data: {
      customerId: user.id,
      proId: pro?.id || null,
      title: input.title,
      description: input.description,
      polishedDescription: input.polishedDescription || null,
      trade: input.trade || pro?.artisanOnboarding?.primaryTrade || null,
      urgency: input.urgency,
      status,
      diagnosticFee,
      surgeFee,
      location: input.location || null,
      lat: input.lat ?? null,
      lng: input.lng ?? null
    }
  })

  if (paymentTotal <= 0) {
    return Response.json({ request, paymentRequired: false }, { headers: corsHeaders })
  }

  const txRef = `BN-HIRE-${Date.now()}-${user.id.slice(0, 6)}`
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  const payment = await prisma.paymentIntent.create({
    data: {
      userId: user.id,
      txRef,
      amount: paymentTotal,
      currency: "GHS",
      status: "pending",
      provider: "paystack",
      channel: "hire_diagnostic",
      items: {
        type: "HIRE_DIAGNOSTIC",
        hireRequestId: request.id,
        title: request.title,
        diagnosticFee,
        surgeFee,
        proId: pro?.id || null
      }
    }
  })

  await prisma.hireRequest.update({
    where: { id: request.id },
    data: { diagnosticPaymentId: payment.id }
  })

  try {
    const response = await initializePaystackTransaction({
      email: String(user.email || ""),
      amount: Math.round(paymentTotal * 100),
      currency: "GHS",
      reference: txRef,
      callback_url: `${baseUrl}/payment/callback`,
      metadata: {
        source: "hire_diagnostic",
        hireRequestId: request.id,
        title: request.title
      }
    })
    const link = response?.data?.authorization_url
    if (!link) throw new Error("Missing payment link")
    await prisma.paymentIntent.update({ where: { id: payment.id }, data: { checkoutUrl: link } })
    return Response.json({ request: { ...request, diagnosticPaymentId: payment.id }, paymentRequired: true, link, txRef }, { headers: corsHeaders })
  } catch (error) {
    console.error("hire.request.payment.error", error)
    return Response.json(
      {
        request: { ...request, diagnosticPaymentId: payment.id },
        paymentRequired: true,
        error: "Hire request saved, but payment checkout is not configured yet."
      },
      { status: 202, headers: corsHeaders }
    )
  }
}
