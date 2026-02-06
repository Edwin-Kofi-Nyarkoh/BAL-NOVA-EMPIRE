import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"

export async function GET(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const url = new URL(req.url)
  const action = url.searchParams.get("action")
  const entity = url.searchParams.get("entity")
  const actor = url.searchParams.get("actor")
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")
  const takeParam = url.searchParams.get("take")
  const take = Math.min(Math.max(Number(takeParam || 100), 1), 500)

  const where: any = {}
  if (action && action !== "all") where.action = action
  if (entity && entity !== "all") where.entityType = entity
  if (actor && actor !== "all") where.actorEmail = { contains: actor, mode: "insensitive" }

  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to) {
      const end = new Date(to)
      end.setHours(23, 59, 59, 999)
      where.createdAt.lte = end
    }
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take
  })

  return Response.json({ logs })
}
