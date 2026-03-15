import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { decryptValue, encryptValue } from "@/lib/server/crypto"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"

const settingsSchema = z.object({
  theme: z.string().max(40).optional(),
  region: z.string().max(80).optional(),
  phone: z.string().max(40).optional(),
  apiKey: z.string().max(500).optional(),
  proTier: z.coerce.number().int().min(0).max(10).optional(),
  autoChat: z.boolean().optional(),
  bayCapacity: z.coerce.number().min(0).max(100000).optional(),
  bayHotPct: z.coerce.number().min(0).max(100).optional(),
  bayACapacity: z.coerce.number().min(0).max(100000).optional(),
  bayBCapacity: z.coerce.number().min(0).max(100000).optional(),
  bayAHotPct: z.coerce.number().min(0).max(100).optional(),
  bayBHotPct: z.coerce.number().min(0).max(100).optional(),
  bayAutoHot: z.boolean().optional()
})

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const userId = (auth.session.user as any).id
  const settings = await prisma.userSettings.findUnique({ where: { userId } })
  if (!settings) return Response.json({ settings })
  return Response.json({
    settings: {
      ...settings,
      apiKey: settings.apiKey ? decryptValue(settings.apiKey) : null
    }
  })
}

export async function PUT(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`user_settings:${ip}`, 30, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))
  const parsed = settingsSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid settings payload" }, { status: 400 })
  }

  const data = {
    theme: parsed.data.theme,
    region: parsed.data.region,
    phone: parsed.data.phone,
    apiKey: parsed.data.apiKey ? encryptValue(parsed.data.apiKey) : undefined,
    proTier: parsed.data.proTier,
    autoChat: parsed.data.autoChat,
    bayCapacity: parsed.data.bayCapacity,
    bayHotPct: parsed.data.bayHotPct,
    bayACapacity: parsed.data.bayACapacity,
    bayBCapacity: parsed.data.bayBCapacity,
    bayAHotPct: parsed.data.bayAHotPct,
    bayBHotPct: parsed.data.bayBHotPct,
    bayAutoHot: parsed.data.bayAutoHot
  }

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data }
  })

  return Response.json({ settings })
}
