import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import { logAuditEvent } from "@/lib/server/audit"
import { applyCors, corsHeaders } from "@/lib/server/cors"

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function GET() {
  const items = await prisma.inventoryItem.findMany({ orderBy: { createdAt: "desc" } })
  return Response.json({ items }, { headers: corsHeaders })
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return applyCors(auth.response)
  const body = await req.json().catch(() => ({}))
  const items = Array.isArray(body.items) ? body.items : null
  const item = body.item

  if (items) {
    const validItems = items
      .map((i: any) => ({
        name: String(i?.name || "").trim(),
        price: Number(i?.price || 0),
        brand: i?.brand ? String(i.brand).trim() : null,
        desc: i?.desc ? String(i.desc).trim() : null,
        imageUrl: i?.imageUrl ? String(i.imageUrl).trim() : null,
        baseStock: Number(i?.baseStock || 0)
      }))
      .filter((i: any) => i.name.length > 0)

    if (!validItems.length) {
      return Response.json({ error: "No valid items provided" }, { status: 400, headers: corsHeaders })
    }

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
    const name = String(item?.name || "").trim()
    if (!name) {
      return Response.json({ error: "Item name is required" }, { status: 400, headers: corsHeaders })
    }
    await prisma.inventoryItem.create({
      data: {
        name,
        price: Number(item.price || 0),
        brand: item.brand || null,
        desc: item.desc ? String(item.desc).trim() : null,
        imageUrl: item.imageUrl ? String(item.imageUrl).trim() : null,
        baseStock: Number(item.baseStock || 0)
      }
    })
    await logAuditEvent({
      actor: auth.session.user,
      action: "inventory.create",
      entityType: "InventoryItem",
      metadata: { name }
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
  const body = await req.json().catch(() => ({}))
  const id = String(body.id || "")
  if (!id) return Response.json({ error: "Missing id" }, { status: 400, headers: corsHeaders })

  const data: { name?: string; price?: number; brand?: string | null; desc?: string | null; imageUrl?: string | null; baseStock?: number } = {}
  if (typeof body.name === "string") {
    const name = body.name.trim()
    if (!name) return Response.json({ error: "Name is required" }, { status: 400, headers: corsHeaders })
    data.name = name
  }
  if (typeof body.price === "number") data.price = body.price
  if (body.brand !== undefined) data.brand = body.brand ? String(body.brand).trim() : null
  if (body.desc !== undefined) data.desc = body.desc ? String(body.desc).trim() : null
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null
  if (typeof body.baseStock === "number") data.baseStock = body.baseStock

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
  const body = await req.json().catch(() => ({}))
  const id = String(body.id || "")
  if (!id) return Response.json({ error: "Missing id" }, { status: 400, headers: corsHeaders })

  await prisma.inventoryItem.delete({ where: { id } })
  await logAuditEvent({
    actor: auth.session.user,
    action: "inventory.delete",
    entityType: "InventoryItem",
    entityId: id
  })
  return Response.json({ ok: true }, { headers: corsHeaders })
}
