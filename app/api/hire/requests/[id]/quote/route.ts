import { prisma } from "@/lib/server/prisma"
import { requireRole } from "@/lib/server/api-auth"
import { applyCors, corsHeaders } from "@/lib/server/cors"
import { z } from "zod"

const quoteSchema = z.object({
  amount: z.coerce.number().min(1).max(1000000),
  note: z.string().trim().min(3).max(2000)
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["pro", "admin"])
  if (!auth.ok) return applyCors(auth.response)
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = quoteSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: "Invalid quote." }, { status: 400, headers: corsHeaders })
  }

  const user = auth.session.user as any
  const request = await prisma.hireRequest.findUnique({ where: { id } })
  if (!request) {
    return Response.json({ error: "Hire request not found." }, { status: 404, headers: corsHeaders })
  }
  if (user.role !== "admin" && request.proId && request.proId !== user.id) {
    return Response.json({ error: "This job belongs to another pro." }, { status: 403, headers: corsHeaders })
  }

  const updated = await prisma.hireRequest.update({
    where: { id },
    data: {
      proId: request.proId || user.id,
      finalQuoteAmount: parsed.data.amount,
      finalQuoteNote: parsed.data.note,
      status: "quoted"
    }
  })

  return Response.json({ request: updated }, { headers: corsHeaders })
}
