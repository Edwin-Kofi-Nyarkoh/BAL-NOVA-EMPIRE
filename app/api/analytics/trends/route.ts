import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"

function toDayKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

export async function GET(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const url = new URL(req.url)
  const range = url.searchParams.get("range") || "7d"
  const days =
    range === "90d" ? 90 :
    range === "30d" ? 30 :
    range === "all" ? null :
    7
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (days) {
    start.setDate(start.getDate() - (days - 1))
  }

  const orders = await prisma.order.findMany({
    where: days ? { createdAt: { gte: start } } : undefined,
    select: { createdAt: true, price: true }
  })

  const map: Record<string, { date: string; orders: number; revenue: number }> = {}

  if (days) {
    for (let i = 0; i < days; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const key = toDayKey(d)
      map[key] = { date: key, orders: 0, revenue: 0 }
    }
  }

  for (const o of orders) {
    const key = toDayKey(o.createdAt)
    if (!map[key]) {
      map[key] = { date: key, orders: 0, revenue: 0 }
    }
    map[key].orders += 1
    map[key].revenue += Number(o.price || 0)
  }

  let series = Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  const maxPoints = 120
  if (series.length > maxPoints) {
    const step = Math.ceil(series.length / maxPoints)
    series = series.filter((_, idx) => idx % step === 0)
  }

  return Response.json({ series })
}
