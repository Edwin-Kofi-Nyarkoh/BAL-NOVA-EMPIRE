import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import { applyCors, corsHeaders } from "@/lib/server/cors"
import { proxyToMicroservice } from "@/lib/server/microservice"

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return applyCors(auth.response)
  const user = auth.session.user as any

  const proxied = await proxyToMicroservice(req, "core", "payments", "GET", {
    "x-user-id": String(user?.id || ""),
    "x-user-role": "admin",
    "x-user-email": String(user?.email || "")
  }).catch(() => null)
  if (proxied) return applyCors(proxied)

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
