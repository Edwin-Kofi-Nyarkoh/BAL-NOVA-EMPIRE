import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"

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
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const name = String(body.name || "").trim()
  const initials = String(body.initials || "").trim()
  const tier = Number(body.tier || 1)

  if (!name) return Response.json({ error: "Name is required" }, { status: 400 })

  const profile = await prisma.vendorProfile.upsert({
    where: { userId },
    update: { name, initials: initials || name.slice(0, 2).toUpperCase(), tier },
    create: { userId, name, initials: initials || name.slice(0, 2).toUpperCase(), tier }
  })

  return Response.json({ profile })
}
