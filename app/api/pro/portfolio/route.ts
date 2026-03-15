import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const portfolioSchema = z.object({
  summary: z.string().max(2000).optional()
})

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id
  const portfolio = await prisma.proPortfolio.findUnique({ where: { userId } })
  return Response.json({ portfolio })
}

export async function PUT(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`pro_portfolio:${ip}`, 20, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const parsed = portfolioSchema.safeParse({
    summary: typeof body.summary === "string" ? body.summary.trim() : ""
  })
  if (!parsed.success) {
    return Response.json({ error: "Invalid portfolio payload" }, { status: 400 })
  }
  const summary = parsed.data.summary || ""

  const portfolio = await prisma.proPortfolio.upsert({
    where: { userId },
    update: { summary },
    create: { userId, summary }
  })

  return Response.json({ portfolio })
}
