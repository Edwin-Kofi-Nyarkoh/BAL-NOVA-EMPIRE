import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const listingSchema = z.object({
  inventoryItemId: z.string().min(2).max(80).optional(),
  name: z.string().min(1).max(200),
  price: z.coerce.number().min(0).max(1_000_000),
  cost: z.coerce.number().min(0).max(1_000_000).optional(),
  status: z.string().min(2).max(20).optional()
})

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id
  const listings = await prisma.resellerListing.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  })
  return Response.json({ listings })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`reseller_listings:${ip}`, 40, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const parsed = listingSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid listing payload" }, { status: 400 })
  }
  const listing = await prisma.resellerListing.create({
    data: {
      userId,
      inventoryItemId: parsed.data.inventoryItemId || null,
      name: parsed.data.name,
      price: parsed.data.price,
      cost: parsed.data.cost ?? null,
      status: parsed.data.status || "active"
    }
  })
  return Response.json({ listing })
}
