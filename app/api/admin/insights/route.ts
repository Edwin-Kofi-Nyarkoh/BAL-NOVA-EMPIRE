import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export async function GET(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`admin_insights:${ip}`, 30, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }

  const now = Date.now()
  const hourAgo = new Date(now - 60 * 60 * 1000)
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000)

  const [orders, ledger, riders, lastAutoAssign, qcCount] = await Promise.all([
    prisma.order.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.financeLedger.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.count({ where: { role: "rider" } }),
    prisma.auditLog.findFirst({
      where: { action: "orders.auto_assign" },
      orderBy: { createdAt: "desc" }
    }),
    prisma.qcLog.count()
  ])

  const delivered = orders.filter((o) => o.deliveredAt)
  const etaMinutes = delivered
    .map((o) => {
      const start = o.createdAt?.getTime() || 0
      const end = o.deliveredAt?.getTime() || 0
      return start && end ? Math.max(0, Math.round((end - start) / 60000)) : 0
    })
    .filter((v) => v > 0)

  const ordersLastHour = orders.filter((o) => o.createdAt >= hourAgo).length
  const ordersLast24h = orders.filter((o) => o.createdAt >= dayAgo).length
  const pendingOrders = orders.filter((o) => !["Delivered", "Completed"].includes(o.status)).length

  const revenue = ledger.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0)
  const costs = ledger.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0)

  const current7 = orders.filter((o) => o.createdAt >= weekAgo)
  const previous7 = orders.filter((o) => o.createdAt < weekAgo && o.createdAt >= twoWeeksAgo)
  const currentSum = current7.reduce((s, o) => s + o.price, 0)
  const previousSum = previous7.reduce((s, o) => s + o.price, 0)
  const deltaPct = previousSum ? ((currentSum - previousSum) / previousSum) * 100 : 0

  const heatmap = orders
    .filter((o) => typeof o.originLat === "number" && typeof o.originLng === "number")
    .map((o) => ({
      lat: Number(o.originLat),
      lng: Number(o.originLng)
    }))

  const zoneBuckets = new Map<string, number>()
  for (const point of heatmap) {
    const lat = Math.round(point.lat * 10) / 10
    const lng = Math.round(point.lng * 10) / 10
    const key = `${lat},${lng}`
    zoneBuckets.set(key, (zoneBuckets.get(key) || 0) + 1)
  }
  const heatmapZones = Array.from(zoneBuckets.entries()).map(([key, count]) => {
    const [lat, lng] = key.split(",").map(Number)
    return { lat, lng, count }
  })

  const reverseLogistics = orders.filter((o) => o.status.toLowerCase().includes("return")).length

  const withCoords = orders.filter((o) => typeof o.originLat === "number" && typeof o.originLng === "number")
  const assignedWithCoords = withCoords.filter((o) => o.riderId).length
  const assignRate = withCoords.length ? Math.round((assignedWithCoords / withCoords.length) * 100) : 0
  const unassignedWithCoords = withCoords.length - assignedWithCoords

  return Response.json({
    ordersSummary: {
      total: orders.length,
      pending: pendingOrders,
      delivered: delivered.length,
      assigned: orders.filter((o) => o.riderId).length
    },
    smartEta: {
      avgMinutes: etaMinutes.length ? Math.round(etaMinutes.reduce((s, v) => s + v, 0) / etaMinutes.length) : 0,
      medianMinutes: Math.round(median(etaMinutes)),
      sampleSize: etaMinutes.length
    },
    systemLoad: {
      ordersLastHour,
      ordersLast24h,
      activeRiders: riders,
      pendingOrders
    },
    reverseLogistics: {
      returns: reverseLogistics
    },
    profitWaterfall: {
      revenue,
      costs,
      net: revenue + costs
    },
    unitEconomics: {
      avgOrderValue: orders.length ? revenue / orders.length : 0,
      orders: orders.length
    },
    revenueVariance: {
      current7d: currentSum,
      previous7d: previousSum,
      deltaPct
    },
    heatmap: heatmapZones,
    routeSolver: {
      lastAutoAssignAt: lastAutoAssign?.createdAt || null,
      assignRate,
      unassignedWithCoords
    },
    qc: {
      totalLogs: qcCount
    }
  })
}
