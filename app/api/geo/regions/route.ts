import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const regionSchema = z.object({
  countryCode: z.string().min(2).max(5),
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(10)
})

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`geo_region:${ip}`, 30, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const parsed = regionSchema.safeParse({
    countryCode: typeof body.countryCode === "string" ? body.countryCode.trim().toUpperCase() : "",
    name: typeof body.name === "string" ? body.name.trim() : "",
    code: typeof body.code === "string" ? body.code.trim().toUpperCase() : ""
  })
  if (!parsed.success) {
    return Response.json({ error: "countryCode, name, and code are required" }, { status: 400 })
  }
  const { countryCode, name, code } = parsed.data

  const country = await prisma.country.findUnique({ where: { code: countryCode } })
  if (!country) {
    return Response.json({ error: "Country not found" }, { status: 404 })
  }

  const region = await prisma.region.create({
    data: {
      countryId: country.id,
      name,
      code,
      createdById: userId
    }
  })

  return Response.json({ region })
}
