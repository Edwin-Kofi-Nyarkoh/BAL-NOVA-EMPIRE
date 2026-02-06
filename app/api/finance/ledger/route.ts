import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"

export async function GET(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  try {
    if (!(prisma as any).financeLedger) {
      return Response.json(
        { error: "Prisma client is missing FinanceLedger. Run prisma generate/db push." },
        { status: 500 }
      )
    }
    const url = new URL(req.url)
    const type = url.searchParams.get("type")
    const status = url.searchParams.get("status")
    const userId = url.searchParams.get("userId")
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200)

    const where = {
      ...(userId ? { userId } : {}),
      ...(type ? { type } : {}),
      ...(status ? { status } : {})
    }

    const entries = await prisma.financeLedger.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit
    })

    return Response.json({ entries })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load ledger."
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  try {
    const body = await req.json().catch(() => ({}))

    const userId = String(body.userId || "").trim()
    const type = String(body.type || "").trim()
    const amount = Number(body.amount || 0)
    const note = String(body.note || "").trim()
    const status = String(body.status || "manual")

    if (!userId || !type || !amount) {
      return Response.json({ error: "userId, type, and amount are required" }, { status: 400 })
    }

    const entry = await prisma.financeLedger.create({
      data: {
        userId,
        type,
        amount,
        status,
        note: note || null
      }
    })

    return Response.json({ entry })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create entry."
    return Response.json({ error: message }, { status: 500 })
  }
}
