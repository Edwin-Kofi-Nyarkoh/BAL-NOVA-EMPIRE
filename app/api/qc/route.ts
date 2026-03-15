import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const qcSchema = z.object({
  status: z.string().min(2).max(20),
  message: z.string().min(1).max(500)
})

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id
  const role = (auth.session.user as any)?.role || "user"
  const logs = await prisma.qcLog.findMany({
    where: role === "admin" ? undefined : { userId },
    orderBy: { createdAt: "desc" },
    take: 200
  })
  return Response.json({ logs })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`qc:${ip}`, 40, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const parsed = qcSchema.safeParse({
    status: typeof body.status === "string" ? body.status : "",
    message: typeof body.message === "string" ? body.message.trim() : ""
  })
  if (!parsed.success) {
    return Response.json({ error: "Invalid QC payload" }, { status: 400 })
  }
  const log = await prisma.qcLog.create({
    data: {
      userId,
      status: parsed.data.status,
      message: parsed.data.message
    }
  })
  return Response.json({ log })
}
