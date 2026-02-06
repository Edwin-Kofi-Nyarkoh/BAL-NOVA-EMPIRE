import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import { applyCors, corsHeaders } from "@/lib/server/cors"

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return applyCors(auth.response)
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, approvalStatus: true, createdAt: true },
    orderBy: { createdAt: "desc" }
  })
  return Response.json({ users }, { headers: corsHeaders })
}
