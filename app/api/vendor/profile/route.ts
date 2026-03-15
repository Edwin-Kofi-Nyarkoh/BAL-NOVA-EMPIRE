import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const vendorProfileSchema = z.object({
  name: z.string().min(1).max(120),
  initials: z.string().max(10).optional(),
  tier: z.coerce.number().int().min(1).max(10).optional()
})

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id
  const profile = await prisma.vendorProfile.findUnique({ where: { userId } })
  return Response.json({ profile })
}

export async function PUT(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`vendor_profile:${ip}`, 30, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const parsed = vendorProfileSchema.safeParse({
    name: typeof body.name === "string" ? body.name.trim() : "",
    initials: typeof body.initials === "string" ? body.initials.trim() : undefined,
    tier: body.tier
  })
  if (!parsed.success) {
    return Response.json({ error: "Name is required" }, { status: 400 })
  }
  const { name, initials, tier } = parsed.data

  const profile = await prisma.vendorProfile.upsert({
    where: { userId },
    update: { name, initials: initials || name.slice(0, 2).toUpperCase(), tier: tier ?? 1 },
    create: { userId, name, initials: initials || name.slice(0, 2).toUpperCase(), tier: tier ?? 1 }
  })

  return Response.json({ profile })
}
