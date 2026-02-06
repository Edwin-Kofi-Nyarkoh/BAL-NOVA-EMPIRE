import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id

  const snapshot = await prisma.cartSnapshot.findUnique({
    where: { id: params.id },
    include: { items: true }
  })
  if (!snapshot || snapshot.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  return Response.json({ snapshot })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id

  const snapshot = await prisma.cartSnapshot.findUnique({ where: { id: params.id } })
  if (!snapshot || snapshot.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.cartSnapshot.delete({ where: { id: params.id } })
  return Response.json({ ok: true })
}
