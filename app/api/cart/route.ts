import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { applyCors, corsHeaders } from "@/lib/server/cors"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const cartItemSchema = z.object({
  productId: z.string().min(1).max(80).optional().nullable(),
  name: z.string().min(1).max(200),
  price: z.coerce.number().min(0).max(1_000_000),
  qty: z.coerce.number().int().min(1).max(999)
})

const cartSchema = z.object({
  items: z.array(cartItemSchema).max(200)
})

const addItemSchema = z.object({
  item: cartItemSchema
})

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

type IncomingItem = {
  productId?: string
  name: string
  price: number
  qty: number
}

export async function GET() {
  try {
    const auth = await requireUser()
    if (!auth.ok) return applyCors(auth.response)
    const userId = (auth.session.user as any).id
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
    }
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: true }
    })
    return Response.json({ items: cart?.items || [] }, { headers: corsHeaders })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load cart"
    return Response.json({ error: "Failed to load cart", details: message }, { status: 500, headers: corsHeaders })
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireUser()
    if (!auth.ok) return applyCors(auth.response)
    const ip = getClientIp(req)
    const limiter = rateLimit(`cart_put:${ip}`, 30, 60 * 1000)
    if (!limiter.ok) {
      return Response.json({ error: "Too many requests. Try again later." }, { status: 429, headers: corsHeaders })
    }
    const userId = (auth.session.user as any).id
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
    }
    const body = await req.json().catch(() => ({}))
    const parsed = cartSchema.safeParse({
      items: Array.isArray(body.items) ? body.items : []
    })
    if (!parsed.success) {
      return Response.json({ error: "Invalid cart payload" }, { status: 400, headers: corsHeaders })
    }
    const items = parsed.data.items as IncomingItem[]

    const cleaned = items
      .map((i) => ({
        productId: i.productId || null,
        name: String(i.name || "").trim(),
        price: Number(i.price || 0),
        qty: Math.max(1, Number(i.qty || 1))
      }))
      .filter((i) => i.name.length > 0)

    const cart = await prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId }
    })

    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } })
    if (cleaned.length) {
      await prisma.cartItem.createMany({
        data: cleaned.map((i) => ({
          cartId: cart.id,
          productId: i.productId,
          name: i.name,
          price: i.price,
          qty: i.qty
        }))
      })
    }

    const fresh = await prisma.cart.findUnique({ where: { id: cart.id }, include: { items: true } })
    return Response.json({ items: fresh?.items || [] }, { headers: corsHeaders })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update cart"
    return Response.json({ error: "Failed to update cart", details: message }, { status: 500, headers: corsHeaders })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireUser()
    if (!auth.ok) return applyCors(auth.response)
    const ip = getClientIp(req)
    const limiter = rateLimit(`cart_add:${ip}`, 60, 60 * 1000)
    if (!limiter.ok) {
      return Response.json({ error: "Too many requests. Try again later." }, { status: 429, headers: corsHeaders })
    }
    const userId = (auth.session.user as any).id
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
    }
    const body = await req.json().catch(() => ({}))
    const parsed = addItemSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Invalid cart item" }, { status: 400, headers: corsHeaders })
    }
    const item = parsed.data.item

    const cart = await prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId }
    })

    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: item.productId || null,
        name: String(item.name).trim(),
        price: Number(item.price || 0),
        qty: Math.max(1, Number(item.qty || 1))
      }
    })

    const fresh = await prisma.cart.findUnique({ where: { id: cart.id }, include: { items: true } })
    return Response.json({ items: fresh?.items || [] }, { headers: corsHeaders })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add to cart"
    return Response.json({ error: "Failed to add to cart", details: message }, { status: 500, headers: corsHeaders })
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireUser()
    if (!auth.ok) return applyCors(auth.response)
    const ip = getClientIp(req)
    const limiter = rateLimit(`cart_del:${ip}`, 20, 60 * 1000)
    if (!limiter.ok) {
      return Response.json({ error: "Too many requests. Try again later." }, { status: 429, headers: corsHeaders })
    }
    const userId = (auth.session.user as any).id
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
    }
    const cart = await prisma.cart.findUnique({ where: { userId } })
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } })
    }
    return Response.json({ ok: true }, { headers: corsHeaders })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to clear cart"
    return Response.json({ error: "Failed to clear cart", details: message }, { status: 500, headers: corsHeaders })
  }
}
