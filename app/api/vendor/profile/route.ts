import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const vendorProfileSchema = z.object({
  name: z.string().min(1).max(120),
  initials: z.string().max(10).optional(),
  tier: z.coerce.number().int().min(1).max(10).optional(),
  bio: z.string().max(1200).optional().nullable(),
  contactPhone: z.string().max(40).optional().nullable(),
  contactEmail: z.string().email().max(160).optional().nullable(),
  businessAddress: z.string().max(240).optional().nullable()
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
    tier: body.tier,
    bio: body.bio !== undefined ? (body.bio ? String(body.bio).trim() : null) : undefined,
    contactPhone: body.contactPhone !== undefined ? (body.contactPhone ? String(body.contactPhone).trim() : null) : undefined,
    contactEmail: body.contactEmail !== undefined ? (body.contactEmail ? String(body.contactEmail).trim() : null) : undefined,
    businessAddress:
      body.businessAddress !== undefined ? (body.businessAddress ? String(body.businessAddress).trim() : null) : undefined
  })
  if (!parsed.success) {
    return Response.json({ error: "Name is required" }, { status: 400 })
  }
  const { name, initials, tier, bio, contactPhone, contactEmail, businessAddress } = parsed.data

  const profile = await prisma.vendorProfile.upsert({
    where: { userId },
    update: {
      name,
      initials: initials || name.slice(0, 2).toUpperCase(),
      tier: tier ?? 1,
      bio: bio ?? null,
      contactPhone: contactPhone ?? null,
      contactEmail: contactEmail ?? null,
      businessAddress: businessAddress ?? null
    },
    create: {
      userId,
      name,
      initials: initials || name.slice(0, 2).toUpperCase(),
      tier: tier ?? 1,
      bio: bio ?? null,
      contactPhone: contactPhone ?? null,
      contactEmail: contactEmail ?? null,
      businessAddress: businessAddress ?? null
    }
  })

  return Response.json({ profile })
}
