import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const brandSchema = z.object({
  name: z.string().min(1).max(120),
  tagline: z.string().max(200).optional(),
  customDomain: z.string().max(200).optional(),
  tier: z.coerce.number().int().min(1).max(10).optional()
})

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id
  const brand = await prisma.resellerBrand.findUnique({ where: { userId } })
  return Response.json({ brand })
}

export async function PUT(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`reseller_brand:${ip}`, 20, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const parsed = brandSchema.safeParse({
    name: typeof body.name === "string" ? body.name.trim() : "",
    tagline: typeof body.tagline === "string" ? body.tagline.trim() : undefined,
    customDomain: typeof body.customDomain === "string" ? body.customDomain.trim() : undefined,
    tier: body.tier
  })
  if (!parsed.success) {
    return Response.json({ error: "Name is required" }, { status: 400 })
  }
  const { name, tagline, customDomain, tier } = parsed.data

  const brand = await prisma.resellerBrand.upsert({
    where: { userId },
    update: { name, tagline: tagline || "", customDomain: customDomain || null, tier: tier ?? 1 },
    create: { userId, name, tagline: tagline || "", customDomain: customDomain || null, tier: tier ?? 1 }
  })

  return Response.json({ brand })
}
