import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const hubSchema = z.object({
  name: z.string().min(1).max(120)
})

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id
  const hubs = await prisma.vendorHub.findMany({ where: { userId }, orderBy: { createdAt: "desc" } })
  return Response.json({ hubs })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`vendor_hub:${ip}`, 30, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const parsed = hubSchema.safeParse({ name: typeof body.name === "string" ? body.name.trim() : "" })
  if (!parsed.success) {
    return Response.json({ error: "Name is required" }, { status: 400 })
  }
  const { name } = parsed.data

  const hub = await prisma.vendorHub.create({ data: { userId, name } })
  return Response.json({ hub })
}
