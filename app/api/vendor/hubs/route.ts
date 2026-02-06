import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"

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
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const name = String(body.name || "").trim()
  if (!name) return Response.json({ error: "Name is required" }, { status: 400 })

  const hub = await prisma.vendorHub.create({ data: { userId, name } })
  return Response.json({ hub })
}
