import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { logAuditEvent } from "@/lib/server/audit"
import { applyCors, corsHeaders } from "@/lib/server/cors"
import { autoAssignOrders } from "@/lib/server/dispatch"
import { z } from "zod"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return applyCors(auth.response)
  const userId = (auth.session.user as any).id
  const role = (auth.session.user as any)?.role || "user"
  const url = new URL(req.url)
  const includeAll = url.searchParams.get("all") === "1" && role === "admin"

  const orders = await prisma.order.findMany({
    where: includeAll ? undefined : { userId },
    orderBy: { createdAt: "desc" }
  })
  return Response.json({ orders }, { headers: corsHeaders })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return applyCors(auth.response)
  const ip = getClientIp(req)
  const limiter = rateLimit(`orders:${ip}`, 60, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers: corsHeaders })
  }
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const orders = Array.isArray(body.orders) ? body.orders : null
  const order = body.order

  const coordsSchema = z
    .object({
      originLat: z.number().finite().optional(),
      originLng: z.number().finite().optional(),
      dropLat: z.number().finite().optional(),
      dropLng: z.number().finite().optional()
    })
    .partial()

  const orderSchema = z.object({
    item: z.string().trim().min(1).max(200),
    price: z.number().min(0),
    status: z.string().trim().min(1).max(32).optional(),
    origin: z.string().trim().min(1).max(200).optional()
  }).merge(coordsSchema)

  if (orders) {
    const parsed = z.array(orderSchema).safeParse(orders)
    if (!parsed.success) {
      return Response.json({ error: "Invalid orders", details: parsed.error.flatten() }, { status: 400, headers: corsHeaders })
    }
    const validOrders = parsed.data.map((o) => ({
      item: o.item,
      price: o.price,
      status: o.status || "Pending",
      origin: o.origin ? String(o.origin).trim() : null,
      originLat: typeof o.originLat === "number" ? o.originLat : null,
      originLng: typeof o.originLng === "number" ? o.originLng : null,
      dropLat: typeof o.dropLat === "number" ? o.dropLat : null,
      dropLng: typeof o.dropLng === "number" ? o.dropLng : null
    }))

    if (!validOrders.length) {
      return Response.json({ error: "No valid orders provided" }, { status: 400, headers: corsHeaders })
    }

    const createdOrders = await prisma.$transaction(
      validOrders.map((o: any) =>
        prisma.order.create({
          data: {
            userId,
            item: o.item,
            price: o.price,
            status: o.status,
            origin: o.origin,
            originLat: typeof o.originLat === "number" ? o.originLat : null,
            originLng: typeof o.originLng === "number" ? o.originLng : null,
            dropLat: typeof o.dropLat === "number" ? o.dropLat : null,
            dropLng: typeof o.dropLng === "number" ? o.dropLng : null
          }
        })
      )
    )
    const assigned = await autoAssignOrders(createdOrders.map((o) => o.id))
    await logAuditEvent({
      actor: auth.session.user,
      action: "orders.auto_assign",
      entityType: "Order",
      metadata: { count: assigned.length }
    })
    await prisma.financeLedger.createMany({
      data: createdOrders.map((o) => ({
        userId,
        orderId: o.id,
        type: ["Completed", "Delivered"].includes(o.status) ? "REVENUE" : "ESCROW",
        amount: Number(o.price || 0),
        status: "posted",
        note: `Order: ${o.item}`
      }))
    })
    await logAuditEvent({
      actor: auth.session.user,
      action: "orders.bulk_create",
      entityType: "Order",
      metadata: { count: validOrders.length }
    })
  } else if (order) {
    const parsed = orderSchema.safeParse(order)
    if (!parsed.success) {
      return Response.json({ error: "Invalid order", details: parsed.error.flatten() }, { status: 400, headers: corsHeaders })
    }
    const item = parsed.data.item
    const createdOrder = await prisma.order.create({
      data: {
        userId,
        item,
        price: Number(parsed.data.price || 0),
        status: parsed.data.status || "Pending",
        origin: parsed.data.origin || null,
        originLat: typeof parsed.data.originLat === "number" ? parsed.data.originLat : null,
        originLng: typeof parsed.data.originLng === "number" ? parsed.data.originLng : null,
        dropLat: typeof parsed.data.dropLat === "number" ? parsed.data.dropLat : null,
        dropLng: typeof parsed.data.dropLng === "number" ? parsed.data.dropLng : null
      }
    })
    const assigned = await autoAssignOrders([createdOrder.id])
    await logAuditEvent({
      actor: auth.session.user,
      action: "orders.auto_assign",
      entityType: "Order",
      metadata: { count: assigned.length }
    })
    await prisma.financeLedger.create({
      data: {
        userId,
        orderId: createdOrder.id,
        type: ["Completed", "Delivered"].includes(order.status || "Pending") ? "REVENUE" : "ESCROW",
        amount: Number(order.price || 0),
        status: "posted",
        note: `Order: ${item}`
      }
    })
    await logAuditEvent({
      actor: auth.session.user,
      action: "orders.create",
      entityType: "Order",
      metadata: { item }
    })
  } else {
    return Response.json({ error: "Invalid payload" }, { status: 400, headers: corsHeaders })
  }

  const newOrders = await prisma.order.findMany({ orderBy: { createdAt: "desc" } })
  return Response.json({ orders: newOrders }, { headers: corsHeaders })
}
