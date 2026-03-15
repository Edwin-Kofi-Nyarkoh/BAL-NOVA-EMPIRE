import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const brands = await prisma.resellerBrand.findMany({
    orderBy: { createdAt: "desc" }
  })
  const team = await prisma.resellerTeam.findMany({ select: { userId: true } })

  const teamCount = team.reduce((acc, row) => {
    acc[row.userId] = (acc[row.userId] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const resellers = brands.map((b) => ({
    id: b.id,
    userId: b.userId,
    name: b.name,
    tagline: b.tagline,
    tier: b.tier,
    teamCount: teamCount[b.userId] || 0,
    createdAt: b.createdAt
  }))

  return Response.json({ resellers })
}
