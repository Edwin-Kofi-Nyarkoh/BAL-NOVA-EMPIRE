import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const [countries, regions, branches] = await Promise.all([
    prisma.country.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.region.findMany({
      include: { country: { select: { code: true } } },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    prisma.branch.findMany({
      include: { region: { select: { code: true, country: { select: { code: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 5
    })
  ])

  return Response.json({ countries, regions, branches })
}
