import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id
  const staff = await prisma.vendorStaff.findMany({ where: { userId }, orderBy: { createdAt: "desc" } })
  return Response.json({ staff })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const name = String(body.name || "").trim()
  const role = String(body.role || "Clerk").trim()
  if (!name) return Response.json({ error: "Name is required" }, { status: 400 })

  const staff = await prisma.vendorStaff.create({ data: { userId, name, role } })
  return Response.json({ staff })
}
