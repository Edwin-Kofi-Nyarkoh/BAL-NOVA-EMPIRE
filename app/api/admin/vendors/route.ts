import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const profiles = await prisma.vendorProfile.findMany({
    orderBy: { createdAt: "desc" }
  })
  const staff = await prisma.vendorStaff.findMany({ select: { userId: true } })
  const hubs = await prisma.vendorHub.findMany({ select: { userId: true } })

  const staffCount = staff.reduce((acc, row) => {
    acc[row.userId] = (acc[row.userId] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const hubCount = hubs.reduce((acc, row) => {
    acc[row.userId] = (acc[row.userId] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const vendors = profiles.map((p) => ({
    id: p.id,
    userId: p.userId,
    name: p.name,
    initials: p.initials,
    tier: p.tier,
    staffCount: staffCount[p.userId] || 0,
    hubCount: hubCount[p.userId] || 0,
    createdAt: p.createdAt
  }))

  return Response.json({ vendors })
}
