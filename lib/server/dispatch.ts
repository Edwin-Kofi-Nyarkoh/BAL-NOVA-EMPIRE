import { prisma } from "@/lib/server/prisma"

type Coord = { lat: number; lng: number }

function distanceMeters(a: Coord, b: Coord) {
  const toRad = (v: number) => (v * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

export async function autoAssignOrders(orderIds: string[]) {
  if (!orderIds.length) return []

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds }, riderId: null, status: "Pending" }
  })
  if (!orders.length) return []

  const systemSettings = await prisma.systemSettings.findFirst()
  const configuredRadius =
    typeof systemSettings?.dispatchRadiusKm === "number" ? systemSettings.dispatchRadiusKm : undefined

  const riders = await prisma.user.findMany({
    where: { role: "rider", approvalStatus: "approved" },
    include: {
      riderState: true,
      riderTasks: { where: { status: { not: "done" } } }
    }
  })
  if (!riders.length) return []

  const assignments: Array<{ orderId: string; riderId: string }> = []
  const radiusKm = configuredRadius ?? Number(process.env.DISPATCH_RADIUS_KM || 8)
  const radiusMeters = Number.isFinite(radiusKm) ? radiusKm * 1000 : 8000

  for (const order of orders) {
    const orderCoord =
      typeof order.originLat === "number" && typeof order.originLng === "number"
        ? { lat: order.originLat, lng: order.originLng }
        : null
    if (!orderCoord) {
      continue
    }

    let best = riders[0]
    let bestScore = Number.POSITIVE_INFINITY

    for (const rider of riders) {
      if (rider.riderState?.status === "Offline") continue
      const activeCount = rider.riderTasks.length
      let score = activeCount * 1000
      if (typeof rider.riderState?.lastLat === "number" && typeof rider.riderState?.lastLng === "number") {
        const dist = distanceMeters(
          { lat: rider.riderState.lastLat, lng: rider.riderState.lastLng },
          orderCoord
        )
        if (dist > radiusMeters) continue
        score += dist
      } else {
        continue
      }
      if (score < bestScore) {
        bestScore = score
        best = rider
      }
    }

    if (bestScore < Number.POSITIVE_INFINITY) {
      assignments.push({ orderId: order.id, riderId: best.id })
    }
  }

  if (!assignments.length) return []

  await prisma.$transaction(
    assignments.map((a) =>
      prisma.order.update({
        where: { id: a.orderId },
        data: { rider: { connect: { id: a.riderId } }, status: "Assigned" }
      })
    )
  )

  return assignments
}
