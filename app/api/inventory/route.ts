import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import { logAuditEvent } from "@/lib/server/audit"
import { applyCors, corsHeaders } from "@/lib/server/cors"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { proxyToMicroservice } from "@/lib/server/microservice"
import { z } from "zod"

const inventoryItemSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.coerce.number().min(0).max(1_000_000),
  brand: z.string().max(80).optional().nullable(),
  desc: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  baseStock: z.coerce.number().int().min(0).max(1_000_000)
})

const inventoryBulkSchema = z.object({
  items: z.array(inventoryItemSchema).min(1).max(2000)
})

const inventoryCreateSchema = z.object({
  item: inventoryItemSchema
})

const inventoryUpdateSchema = z.object({
  id: z.string().min(2).max(80),
  name: z.string().min(1).max(200).optional(),
  price: z.coerce.number().min(0).max(1_000_000).optional(),
  brand: z.string().max(80).optional().nullable(),
  desc: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  baseStock: z.coerce.number().int().min(0).max(1_000_000).optional()
})

const inventoryDeleteSchema = z.object({
  id: z.string().min(2).max(80)
})

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: Request) {
  const proxied = await proxyToMicroservice(req, "api", "inventory", "GET").catch(() => null)
  if (proxied && proxied.ok) return applyCors(proxied)

  const items = await prisma.inventoryItem.findMany({ orderBy: { createdAt: "desc" } })
  return Response.json({ items }, { headers: corsHeaders })
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return applyCors(auth.response)
  const ip = getClientIp(req)
  const limiter = rateLimit(`inventory_post:${ip}`, 20, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429, headers: corsHeaders })
  }
  const body = await req.json().catch(() => ({}))
  const items = Array.isArray(body.items) ? body.items : null
  const item = body.item

  if (items) {
    const parsed = inventoryBulkSchema.safeParse({ items })
    if (!parsed.success) {
      return Response.json({ error: "No valid items provided" }, { status: 400, headers: corsHeaders })
    }
    const validItems = parsed.data.items.map((i) => ({
      name: i.name.trim(),
      price: i.price,
      brand: i.brand ?? null,
      desc: i.desc ?? null,
      imageUrl: i.imageUrl ?? null,
      baseStock: i.baseStock
    }))

    await prisma.$transaction([
      prisma.inventoryItem.deleteMany(),
      prisma.inventoryItem.createMany({ data: validItems })
    ])
    await logAuditEvent({
      actor: auth.session.user,
      action: "inventory.bulk_replace",
      entityType: "InventoryItem",
      metadata: { count: validItems.length }
    })
  } else if (item) {
    const parsed = inventoryCreateSchema.safeParse({ item })
    if (!parsed.success) {
      return Response.json({ error: "Item name is required" }, { status: 400, headers: corsHeaders })
    }
    const data = parsed.data.item
    await prisma.inventoryItem.create({
      data: {
        name: data.name.trim(),
        price: data.price,
        brand: data.brand ?? null,
        desc: data.desc ?? null,
        imageUrl: data.imageUrl ?? null,
        baseStock: data.baseStock
      }
    })
    await logAuditEvent({
      actor: auth.session.user,
      action: "inventory.create",
      entityType: "InventoryItem",
      metadata: { name: data.name }
    })
  } else {
    return Response.json({ error: "Invalid payload" }, { status: 400, headers: corsHeaders })
  }

  const newItems = await prisma.inventoryItem.findMany({ orderBy: { createdAt: "desc" } })
  return Response.json({ items: newItems }, { headers: corsHeaders })
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return applyCors(auth.response)
  const ip = getClientIp(req)
  const limiter = rateLimit(`inventory_patch:${ip}`, 40, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429, headers: corsHeaders })
  }
  const body = await req.json().catch(() => ({}))
  const parsed = inventoryUpdateSchema.safeParse({
    id: typeof body.id === "string" ? body.id.trim() : "",
    name: typeof body.name === "string" ? body.name.trim() : undefined,
    price: body.price,
    brand: body.brand !== undefined ? (body.brand ? String(body.brand).trim() : null) : undefined,
    desc: body.desc !== undefined ? (body.desc ? String(body.desc).trim() : null) : undefined,
    imageUrl: body.imageUrl !== undefined ? (body.imageUrl ? String(body.imageUrl).trim() : null) : undefined,
    baseStock: body.baseStock
  })
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400, headers: corsHeaders })
  }
  const { id, ...data } = parsed.data
  if (!Object.keys(data).length) {
    return Response.json({ error: "No updates provided" }, { status: 400, headers: corsHeaders })
  }

  const updated = await prisma.inventoryItem.update({ where: { id }, data })
  await logAuditEvent({
    actor: auth.session.user,
    action: "inventory.update",
    entityType: "InventoryItem",
    entityId: id,
    metadata: { name: updated.name }
  })
  return Response.json({ item: updated }, { headers: corsHeaders })
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return applyCors(auth.response)
  const ip = getClientIp(req)
  const limiter = rateLimit(`inventory_delete:${ip}`, 20, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429, headers: corsHeaders })
  }
  const body = await req.json().catch(() => ({}))
  const parsed = inventoryDeleteSchema.safeParse({ id: typeof body.id === "string" ? body.id.trim() : "" })
  if (!parsed.success) {
    return Response.json({ error: "Missing id" }, { status: 400, headers: corsHeaders })
  }
  const id = parsed.data.id

  await prisma.inventoryItem.delete({ where: { id } })
  await logAuditEvent({
    actor: auth.session.user,
    action: "inventory.delete",
    entityType: "InventoryItem",
    entityId: id
  })
  return Response.json({ ok: true }, { headers: corsHeaders })
}
