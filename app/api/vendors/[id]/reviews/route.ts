import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const vendorReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().max(120).optional().nullable(),
  comment: z.string().max(1200).optional().nullable()
})

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(req: Request, context: RouteContext) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const { id: vendorId } = await context.params
  const user = auth.session.user as any
  const userId = String(user.id || "")

  if (userId === vendorId) {
    return Response.json({ error: "You cannot review your own vendor storefront." }, { status: 400 })
  }

  const vendor = await prisma.user.findUnique({
    where: { id: vendorId },
    select: { id: true, role: true, vendorProfile: { select: { id: true } } }
  })
  if (!vendor || vendor.role !== "vendor" || !vendor.vendorProfile) {
    return Response.json({ error: "Vendor not found" }, { status: 404 })
  }

  const ip = getClientIp(req)
  const limiter = rateLimit(`vendor_review:${vendorId}:${ip}`, 10, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many review attempts. Try again later." }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = vendorReviewSchema.safeParse({
    rating: body.rating,
    title: body.title !== undefined ? (body.title ? String(body.title).trim() : null) : undefined,
    comment: body.comment !== undefined ? (body.comment ? String(body.comment).trim() : null) : undefined
  })
  if (!parsed.success) {
    return Response.json({ error: "Invalid review payload" }, { status: 400 })
  }

  const review = await prisma.vendorReview.upsert({
    where: {
      vendorId_userId: {
        vendorId,
        userId
      }
    },
    update: {
      rating: parsed.data.rating,
      title: parsed.data.title ?? null,
      comment: parsed.data.comment ?? null
    },
    create: {
      vendorId,
      userId,
      rating: parsed.data.rating,
      title: parsed.data.title ?? null,
      comment: parsed.data.comment ?? null
    }
  })

  return Response.json({ review })
}
