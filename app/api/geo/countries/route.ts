import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const countrySchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(5),
  flag: z.string().max(200).optional().nullable(),
  currency: z.string().max(20).optional().nullable()
})

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const countries = await prisma.country.findMany({
    orderBy: { createdAt: "desc" }
  })
  return Response.json({ countries })
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`geo_country:${ip}`, 20, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const parsed = countrySchema.safeParse({
    name: typeof body.name === "string" ? body.name.trim() : "",
    code: typeof body.code === "string" ? body.code.trim().toUpperCase() : "",
    flag: typeof body.flag === "string" ? body.flag.trim() : body.flag ?? null,
    currency: typeof body.currency === "string" ? body.currency.trim() : body.currency ?? null
  })
  if (!parsed.success) {
    return Response.json({ error: "Name and valid country code are required" }, { status: 400 })
  }
  const { name, code, flag, currency } = parsed.data

  const country = await prisma.country.create({
    data: {
      name,
      code,
      flag,
      currency,
      createdById: userId
    }
  })
  return Response.json({ country })
}
