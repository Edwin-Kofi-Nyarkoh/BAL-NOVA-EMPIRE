import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const resellerTeamSchema = z.object({
  name: z.string().min(1).max(120),
  role: z.string().min(2).max(40).optional()
})

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id
  const team = await prisma.resellerTeam.findMany({ where: { userId }, orderBy: { createdAt: "desc" } })
  return Response.json({ team })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`reseller_team:${ip}`, 30, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const parsed = resellerTeamSchema.safeParse({
    name: typeof body.name === "string" ? body.name.trim() : "",
    role: typeof body.role === "string" ? body.role.trim() : undefined
  })
  if (!parsed.success) {
    return Response.json({ error: "Name is required" }, { status: 400 })
  }
  const { name, role } = parsed.data

  const team = await prisma.resellerTeam.create({ data: { userId, name, role: role || "Associate" } })
  return Response.json({ team })
}
