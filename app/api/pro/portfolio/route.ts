import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"

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
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const summary = String(body.summary || "").trim()

  const portfolio = await prisma.proPortfolio.upsert({
    where: { userId },
    update: { summary },
    create: { userId, summary }
  })

  return Response.json({ portfolio })
}
