import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const createAddressSchema = z.object({
  label: z.string().min(1).max(120),
  note: z.string().max(500).optional().nullable()
})

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id
  const addresses = await prisma.address.findMany({ where: { userId }, orderBy: { createdAt: "desc" } })
  return Response.json({ addresses })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`addr_create:${ip}`, 30, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const parsed = createAddressSchema.safeParse({
    label: typeof body.label === "string" ? body.label.trim() : "",
    note: typeof body.note === "string" ? body.note.trim() : body.note ?? null
  })
  if (!parsed.success) {
    return Response.json({ error: "Invalid address payload" }, { status: 400 })
  }
  const { label, note } = parsed.data

  const address = await prisma.address.create({
    data: { userId, label, note }
  })
  return Response.json({ address })
}
