import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id
  const { id } = await params

  const snapshot = await prisma.cartSnapshot.findUnique({
    where: { id },
    include: { items: true }
  })
  if (!snapshot || snapshot.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  return Response.json({ snapshot })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(_req)
  const limiter = rateLimit(`cart_snapshot_del:${ip}`, 20, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const { id } = await params

  const snapshot = await prisma.cartSnapshot.findUnique({ where: { id } })
  if (!snapshot || snapshot.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.cartSnapshot.delete({ where: { id } })
  return Response.json({ ok: true })
}
