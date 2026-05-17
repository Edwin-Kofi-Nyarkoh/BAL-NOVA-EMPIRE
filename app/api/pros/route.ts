import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { applyCors, corsHeaders } from "@/lib/server/cors"

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return applyCors(auth.response)

  const pros = await prisma.user.findMany({
    where: { role: "pro", approvalStatus: "approved" },
    select: {
      id: true,
      name: true,
      proPortfolio: { select: { summary: true } },
      artisanOnboarding: {
        select: {
          track: true,
          primaryTrade: true,
          tradeCategories: true,
          operationalBase: true,
          officeLocation: true,
          diagnosticFee: true,
          bio: true,
          headshotUrl: true,
          logoUrl: true
        }
      },
      proTeam: { select: { id: true } }
    },
    orderBy: { createdAt: "desc" }
  })

  const payload = pros.map((pro) => ({
    id: pro.id,
    name: pro.name,
    summary: pro.artisanOnboarding?.bio || pro.proPortfolio?.summary || null,
    track: pro.artisanOnboarding?.track || null,
    primaryTrade: pro.artisanOnboarding?.primaryTrade || null,
    tradeCategories: pro.artisanOnboarding?.tradeCategories || [],
    location: pro.artisanOnboarding?.operationalBase || pro.artisanOnboarding?.officeLocation || null,
    diagnosticFee: Number(pro.artisanOnboarding?.diagnosticFee || 0),
    avatarUrl: pro.artisanOnboarding?.headshotUrl || pro.artisanOnboarding?.logoUrl || null,
    teamCount: pro.proTeam.length
  }))

  return Response.json({ pros: payload }, { headers: corsHeaders })
}
