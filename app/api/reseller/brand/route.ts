import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"

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
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const name = String(body.name || "").trim()
  const tagline = String(body.tagline || "").trim()
  const tier = Number(body.tier || 1)

  if (!name) return Response.json({ error: "Name is required" }, { status: 400 })

  const brand = await prisma.resellerBrand.upsert({
    where: { userId },
    update: { name, tagline, tier },
    create: { userId, name, tagline, tier }
  })

  return Response.json({ brand })
}
