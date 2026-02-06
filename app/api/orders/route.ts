import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { logAuditEvent } from "@/lib/server/audit"
import { applyCors, corsHeaders } from "@/lib/server/cors"

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
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const orders = Array.isArray(body.orders) ? body.orders : null
  const order = body.order

  if (orders) {
    const validOrders = orders
      .map((o: any) => ({
        item: String(o?.item || "").trim(),
        price: Number(o?.price || 0),
        status: String(o?.status || "Pending"),
        origin: o?.origin ? String(o.origin).trim() : null
      }))
      .filter((o: any) => o.item.length > 0)

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
            origin: o.origin
          }
        })
      )
    )
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
    const item = String(order?.item || "").trim()
    if (!item) {
      return Response.json({ error: "Order item is required" }, { status: 400, headers: corsHeaders })
    }
    const createdOrder = await prisma.order.create({
      data: {
        userId,
        item,
        price: Number(order.price || 0),
        status: order.status || "Pending",
        origin: order.origin || null
      }
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
