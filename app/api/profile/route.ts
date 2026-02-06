import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { applyCors, corsHeaders } from "@/lib/server/cors"

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function GET() {
  try {
    const auth = await requireUser()
    if (!auth.ok) return applyCors(auth.response)
    const userId = (auth.session.user as any)?.id
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
    return Response.json({ user }, { headers: corsHeaders })
  } catch (error) {
    return Response.json(
      { error: "Failed to load profile", details: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: corsHeaders }
    )
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireUser()
    if (!auth.ok) return applyCors(auth.response)
    const userId = (auth.session.user as any)?.id
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
    }
    const body = await req.json().catch(() => ({}))
    const name = String(body.name || "").trim()
    if (!name) return Response.json({ error: "Name is required" }, { status: 400, headers: corsHeaders })

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name },
      select: { name: true, email: true }
    })
    return Response.json({ user }, { headers: corsHeaders })
  } catch (error) {
    return Response.json(
      { error: "Failed to update profile", details: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: corsHeaders }
    )
  }
}
