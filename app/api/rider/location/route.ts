import { prisma } from "@/lib/server/prisma"
import { requireRider } from "@/lib/server/api-auth"
import { z } from "zod"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"

type LocationBody = {
  lat?: number
  lng?: number
  heading?: number | null
  accuracy?: number | null
}

export async function POST(req: Request) {
  const auth = await requireRider()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`rider_loc:${ip}`, 120, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests" }, { status: 429 })
  }
  const userId = (auth.session.user as any).id as string
  const body = (await req.json().catch(() => ({}))) as LocationBody
  const schema = z.object({
    lat: z.number().finite(),
    lng: z.number().finite(),
    heading: z.number().finite().nullable().optional(),
    accuracy: z.number().finite().nullable().optional()
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid coordinates" }, { status: 400 })
  }

  await prisma.riderState.upsert({
    where: { userId },
    update: {
      lastLat: parsed.data.lat,
      lastLng: parsed.data.lng,
      lastHeading: typeof parsed.data.heading === "number" ? parsed.data.heading : null,
      lastAccuracy: typeof parsed.data.accuracy === "number" ? parsed.data.accuracy : null,
      lastLocationAt: new Date()
    },
    create: {
      userId,
      lastLat: parsed.data.lat,
      lastLng: parsed.data.lng,
      lastHeading: typeof parsed.data.heading === "number" ? parsed.data.heading : null,
      lastAccuracy: typeof parsed.data.accuracy === "number" ? parsed.data.accuracy : null,
      lastLocationAt: new Date()
    }
  })

  return Response.json({ ok: true })
}
