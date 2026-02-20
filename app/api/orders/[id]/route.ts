import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { applyCors, corsHeaders } from "@/lib/server/cors"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const updateOrderSchema = z.object({
  status: z.string().min(2).max(40)
})

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return applyCors(auth.response)
  const ip = getClientIp(req)
  const limiter = rateLimit(`order_patch:${ip}`, 30, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429, headers: corsHeaders })
  }
  const userId = (auth.session.user as any).id
  const role = (auth.session.user as any)?.role || "user"

  const { id } = await params
  if (!id) return Response.json({ error: "Missing order id" }, { status: 400, headers: corsHeaders })

  const body = await req.json().catch(() => ({}))
  const parsed = updateOrderSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Status is required" }, { status: 400, headers: corsHeaders })
  }
  const status = parsed.data.status

  const order = await prisma.order.findUnique({ where: { id } })
  if (!order) {
    return Response.json({ error: "Order not found" }, { status: 404, headers: corsHeaders })
  }
  if (role !== "admin" && order.userId !== userId) {
    return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders })
  }

  const shouldSetAcceptedAt =
    !order.acceptedAt && ["accepted", "connected", "in progress"].includes(status.toLowerCase())

  const updated = await prisma.order.update({
    where: { id },
    data: {
      status,
      ...(shouldSetAcceptedAt ? { acceptedAt: new Date() } : {})
    }
  })

  return Response.json({ order: updated }, { headers: corsHeaders })
}
