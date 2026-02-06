import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id
  const team = await prisma.proTeam.findMany({ where: { userId }, orderBy: { createdAt: "desc" } })
  return Response.json({ team })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const name = String(body.name || "").trim()
  const role = String(body.role || "Associate").trim()
  if (!name) return Response.json({ error: "Name is required" }, { status: 400 })

  const member = await prisma.proTeam.create({ data: { userId, name, role } })
  return Response.json({ member })
}
