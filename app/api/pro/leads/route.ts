import { prisma } from "@/lib/server/prisma"
import { requireRole } from "@/lib/server/api-auth"
import { inferLeadCreditCost } from "@/lib/server/nova-credits"

function isOpenLeadStatus(status: string) {
  const normalized = status.toLowerCase()
  return !["delivered", "completed", "cancelled", "canceled", "refunded"].includes(normalized)
}

export async function GET() {
  const auth = await requireRole(["pro", "admin"])
  if (!auth.ok) return auth.response

  const proId = (auth.session.user as any).id as string
  const orders = await prisma.order.findMany({
    where: {
      status: {
        notIn: ["Delivered", "Completed", "Cancelled", "Canceled", "Refunded"]
      }
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      leadUnlocks: {
        where: { proId },
        take: 1
      },
      user: {
        select: {
          name: true,
          email: true,
          settings: {
            select: { phone: true }
          }
        }
      }
    }
  })

  const leads = orders.filter((order) => isOpenLeadStatus(order.status)).map((order) => {
    const unlock = order.leadUnlocks[0] || null
    const creditCost = inferLeadCreditCost(order)
    const unlocked = Boolean(unlock)

    return {
      id: order.id,
      title: order.item,
      budget: order.price,
      location: order.origin || "Accra",
      status: order.status,
      createdAt: order.createdAt,
      acceptedAt: unlock?.createdAt || order.acceptedAt || null,
      unlocked,
      unlockStatus: unlock?.status || null,
      creditCost,
      isBlitz: creditCost > 10,
      contactDeadline: unlock?.contactDeadline || null,
      customer: unlocked
        ? {
            name: order.user?.name || "Customer",
            email: order.user?.email || null,
            phone: order.user?.settings?.phone || null
          }
        : null,
      exactLocation: unlocked
        ? {
            origin: order.origin || null,
            originLat: order.originLat,
            originLng: order.originLng,
            dropLat: order.dropLat,
            dropLng: order.dropLng
          }
        : null
    }
  })

  return Response.json({ leads })
}
