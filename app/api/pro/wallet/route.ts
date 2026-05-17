import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { getNovaCreditBalance } from "@/lib/server/nova-credits"

export async function GET(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const userId = (auth.session.user as any).id
  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200)

  const entries = await prisma.novaCreditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit
  })

  const credits = await getNovaCreditBalance(prisma, userId)

  return Response.json({ credits, entries })
}
