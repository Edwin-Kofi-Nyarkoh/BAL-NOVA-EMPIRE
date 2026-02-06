import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const portfolios = await prisma.proPortfolio.findMany({
    orderBy: { createdAt: "desc" }
  })
  const team = await prisma.proTeam.findMany({ select: { userId: true } })

  const teamCount = team.reduce((acc, row) => {
    acc[row.userId] = (acc[row.userId] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const pros = portfolios.map((p) => ({
    id: p.id,
    userId: p.userId,
    summary: p.summary,
    teamCount: teamCount[p.userId] || 0,
    createdAt: p.createdAt
  }))

  return Response.json({ pros })
}
