import { prisma } from "@/lib/server/prisma"
import { requireRole } from "@/lib/server/api-auth"
import {
  contactDeadlineFrom,
  getNovaCreditBalance,
  inferLeadCreditCost,
  postNovaCreditTransaction
} from "@/lib/server/nova-credits"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"

function leadPayload(order: any, unlock: any, balance: number) {
  return {
    lead: {
      id: order.id,
      title: order.item,
      budget: order.price,
      location: order.origin || "Accra",
      status: order.status,
      createdAt: order.createdAt,
      acceptedAt: unlock.createdAt,
      unlocked: true,
      unlockStatus: unlock.status,
      creditCost: unlock.creditCost,
      contactDeadline: unlock.contactDeadline,
      customer: {
        name: order.user?.name || "Customer",
        email: order.user?.email || null,
        phone: order.user?.settings?.phone || null
      },
      exactLocation: {
        origin: order.origin || null,
        originLat: order.originLat,
        originLng: order.originLng,
        dropLat: order.dropLat,
        dropLng: order.dropLng
      }
    },
    credits: balance
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["pro", "admin"])
  if (!auth.ok) return auth.response

  const ip = getClientIp(req)
  const limiter = rateLimit(`pro_lead_unlock:${ip}`, 30, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many lead unlock attempts. Try again later." }, { status: 429 })
  }

  const proId = (auth.session.user as any).id as string
  const { id } = await params
  if (!id) return Response.json({ error: "Missing lead id." }, { status: 400 })

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id },
          include: {
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

        if (!order) return { response: Response.json({ error: "Lead not found." }, { status: 404 }) }

        const closedStatuses = ["delivered", "completed", "cancelled", "canceled", "refunded"]
        if (closedStatuses.includes(order.status.toLowerCase())) {
          return { response: Response.json({ error: "This lead is no longer available." }, { status: 409 }) }
        }

        const existing = await tx.leadUnlock.findUnique({
          where: { proId_orderId: { proId, orderId: order.id } }
        })
        if (existing) {
          const balance = await getNovaCreditBalance(tx as any, proId)
          return { payload: leadPayload(order, existing, balance) }
        }

        const creditCost = inferLeadCreditCost(order)
        const balance = await getNovaCreditBalance(tx as any, proId)
        if (balance < creditCost) {
          return {
            response: Response.json(
              {
                error: "Insufficient Nova Credits.",
                credits: balance,
                requiredCredits: creditCost
              },
              { status: 402 }
            )
          }
        }

        const now = new Date()
        const unlock = await tx.leadUnlock.create({
          data: {
            proId,
            orderId: order.id,
            creditCost,
            contactDeadline: contactDeadlineFrom(now),
            createdAt: now
          }
        })

        await postNovaCreditTransaction(tx as any, {
          userId: proId,
          amount: -creditCost,
          type: "lead_unlock",
          source: "lead_unlock",
          reference: `${proId}:${order.id}`,
          note: `Unlocked lead: ${order.item}`,
          metadata: {
            orderId: order.id,
            leadUnlockId: unlock.id,
            nonRefundable: true,
            slaMinutes: 15
          }
        })

        const nextBalance = balance - creditCost
        return { payload: leadPayload(order, unlock, nextBalance) }
      },
      { isolationLevel: "Serializable" as any }
    )

    if ("response" in result && result.response) return result.response
    return Response.json(result.payload)
  } catch (error: any) {
    if (String(error?.code || "") === "P2002") {
      return Response.json({ error: "Lead was already unlocked." }, { status: 409 })
    }
    console.error("pro.lead.unlock.error", error)
    return Response.json({ error: "Unable to unlock this lead." }, { status: 500 })
  }
}
