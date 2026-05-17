import type { Order, Prisma, PrismaClient } from "../../generated/prisma"

const STANDARD_LEAD_COST = 10
const BLITZ_LEAD_COST = 25
const CONTACT_SLA_MINUTES = 15

type TxClient = Prisma.TransactionClient | PrismaClient

export function inferLeadCreditCost(order: Pick<Order, "item" | "origin" | "status">) {
  const text = `${order.item || ""} ${order.origin || ""} ${order.status || ""}`.toLowerCase()
  return /\b(blitz|emergency|panic|urgent|sos)\b/.test(text) ? BLITZ_LEAD_COST : STANDARD_LEAD_COST
}

export function contactDeadlineFrom(date = new Date()) {
  return new Date(date.getTime() + CONTACT_SLA_MINUTES * 60 * 1000)
}

export async function getNovaCreditBalance(prisma: TxClient, userId: string) {
  const aggregate = await prisma.novaCreditTransaction.aggregate({
    _sum: { amount: true },
    where: { userId, status: "posted" }
  })
  return Number(aggregate._sum.amount || 0)
}

export async function postNovaCreditTransaction(
  prisma: TxClient,
  data: {
    userId: string
    amount: number
    type: string
    source?: string
    reference?: string
    note?: string
    metadata?: Prisma.InputJsonValue
  }
) {
  return prisma.novaCreditTransaction.create({
    data: {
      userId: data.userId,
      amount: Math.trunc(data.amount),
      type: data.type,
      source: data.source || null,
      reference: data.reference || null,
      note: data.note || null,
      metadata: data.metadata ?? undefined
    }
  })
}
