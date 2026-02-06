import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { decryptValue, encryptValue } from "@/lib/server/crypto"

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
  const userId = (auth.session.user as any).id
  const body = await req.json().catch(() => ({}))

  const data = {
    theme: typeof body.theme === "string" ? body.theme : undefined,
    region: typeof body.region === "string" ? body.region : undefined,
    phone: typeof body.phone === "string" ? body.phone : undefined,
    apiKey: typeof body.apiKey === "string" ? encryptValue(body.apiKey) : undefined,
    proTier: typeof body.proTier === "number" ? body.proTier : undefined,
    autoChat: typeof body.autoChat === "boolean" ? body.autoChat : undefined,
    bayCapacity: typeof body.bayCapacity === "number" ? body.bayCapacity : undefined,
    bayHotPct: typeof body.bayHotPct === "number" ? body.bayHotPct : undefined,
    bayACapacity: typeof body.bayACapacity === "number" ? body.bayACapacity : undefined,
    bayBCapacity: typeof body.bayBCapacity === "number" ? body.bayBCapacity : undefined,
    bayAHotPct: typeof body.bayAHotPct === "number" ? body.bayAHotPct : undefined,
    bayBHotPct: typeof body.bayBHotPct === "number" ? body.bayBHotPct : undefined,
    bayAutoHot: typeof body.bayAutoHot === "boolean" ? body.bayAutoHot : undefined
  }

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data }
  })

  return Response.json({ settings })
}
