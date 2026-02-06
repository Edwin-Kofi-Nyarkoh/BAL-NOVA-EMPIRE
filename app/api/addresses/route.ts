import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id
  const addresses = await prisma.address.findMany({ where: { userId }, orderBy: { createdAt: "desc" } })
  return Response.json({ addresses })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const label = String(body.label || "").trim()
  const note = body.note ? String(body.note).trim() : null
  if (!label) return Response.json({ error: "Label is required" }, { status: 400 })

  const address = await prisma.address.create({
    data: { userId, label, note }
  })
  return Response.json({ address })
}
