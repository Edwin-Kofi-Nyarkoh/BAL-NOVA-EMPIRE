import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const branchSchema = z.object({
  regionId: z.string().min(2).max(80),
  name: z.string().min(2).max(120)
})

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`geo_branch:${ip}`, 30, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const parsed = branchSchema.safeParse({
    regionId: typeof body.regionId === "string" ? body.regionId.trim() : "",
    name: typeof body.name === "string" ? body.name.trim() : ""
  })
  if (!parsed.success) {
    return Response.json({ error: "regionId and name are required" }, { status: 400 })
  }
  const { regionId, name } = parsed.data

  const region = await prisma.region.findUnique({ where: { id: regionId } })
  if (!region) {
    return Response.json({ error: "Region not found" }, { status: 404 })
  }

  const branch = await prisma.branch.create({
    data: {
      regionId,
      name,
      createdById: userId
    }
  })

  return Response.json({ branch })
}
