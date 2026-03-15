import { prisma } from "@/lib/server/prisma"
import { notifyPaymentReceipt } from "@/lib/server/notifications"

type VerifiedData = {
  id: number | string
  reference: string
  status: string
  amount: number
  currency: string
}

export async function syncPaymentFromPaystack(data: VerifiedData) {
  const txRef = String(data.reference || "")
  if (!txRef) return { ok: false, error: "Missing tx_ref" }

  const payment = await prisma.paymentIntent.findUnique({ where: { txRef } })
  if (!payment) return { ok: false, error: "Payment not found" }

  const normalizedStatus = String(data.status || "").toLowerCase()

  if (normalizedStatus !== "success") {
    await prisma.paymentIntent.update({
      where: { id: payment.id },
      data: { status: normalizedStatus || "failed", gatewayId: String(data.id) }
    })
    return { ok: true, status: normalizedStatus }
  }

  if (payment.status === "successful") {
    return { ok: true, status: "success", alreadyProcessed: true }
  }

  const expectedAmount = Number(payment.amount || 0)
  const amount = Number(data.amount || 0)
  const currency = String(data.currency || "")

  if (currency !== payment.currency || amount + 0.01 < expectedAmount) {
    await prisma.paymentIntent.update({
      where: { id: payment.id },
      data: { status: "mismatch", gatewayId: String(data.id) }
    })
    return { ok: false, error: "Amount or currency mismatch" }
  }

  const items = typeof payment.items === "object" && payment.items ? (payment.items as any) : {}
  if (items.type === "PRO_CREDITS") {
    await prisma.paymentIntent.update({
      where: { id: payment.id },
      data: {
        status: "successful",
        gatewayId: String(data.id),
        completedAt: new Date()
      }
    })

    await prisma.financeLedger.create({
      data: {
        userId: payment.userId,
        type: "CREDIT",
        amount: Number(payment.amount || 0),
        status: "posted",
        note: "Pro credit top-up"
      }
    })

    const user = await prisma.user.findUnique({ where: { id: payment.userId } })
    if (user?.email) {
      await notifyPaymentReceipt({
        email: user.email,
        name: user.name,
        amount: Number(payment.amount || 0),
        currency: payment.currency,
        reference: payment.txRef
      })
    }

    return { ok: true, status: "successful", creditTopUp: true }
  }

  const lineItems = Array.isArray(items.items) ? items.items : []

  const createdOrders = await prisma.$transaction([
    prisma.paymentIntent.update({
      where: { id: payment.id },
      data: {
        status: "successful",
        gatewayId: String(data.id),
        completedAt: new Date()
      }
    }),
    ...lineItems.map((item: any) =>
      prisma.order.create({
        data: {
          userId: payment.userId,
          paymentId: payment.id,
          item: String(item.name || "").trim() || "Item",
          price: Number(item.price || 0) * Number(item.qty || 1),
          status: "Paid",
          origin: payment.channel || null
        }
      })
    )
  ])

  const orders = createdOrders.slice(1) as any[]
  if (orders.length > 0) {
    await prisma.financeLedger.createMany({
      data: orders.map((o) => ({
        userId: payment.userId,
        orderId: o.id,
        type: "REVENUE",
        amount: Number(o.price || 0),
        status: "posted",
        note: `Order: ${o.item}`
      }))
    })
  }

  await prisma.cartItem.deleteMany({
    where: { cart: { userId: payment.userId } }
  })

  const user = await prisma.user.findUnique({ where: { id: payment.userId } })
  if (user?.email) {
    await notifyPaymentReceipt({
      email: user.email,
      name: user.name,
      amount: Number(payment.amount || 0),
      currency: payment.currency,
      reference: payment.txRef
    })
  }

  return { ok: true, status: "successful" }
}
