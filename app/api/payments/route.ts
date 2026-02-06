import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import { applyCors, corsHeaders } from "@/lib/server/cors"

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return applyCors(auth.response)

  try {
    const payments = await prisma.paymentIntent.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, email: true, role: true } } }
    })

    return Response.json({ payments }, { headers: corsHeaders })
  } catch (error) {
    console.error("payments.list.error", error)
    return Response.json({ error: "Unable to load payments." }, { status: 500, headers: corsHeaders })
  }
}
