import crypto from "crypto"
import { verifyPaystackTransaction } from "@/lib/server/paystack"
import { syncPaymentFromPaystack } from "@/lib/server/payments"

export async function POST(req: Request) {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY
    const signature = req.headers.get("x-paystack-signature")

    const rawBody = await req.text()

    if (secret && signature) {
      const computed = crypto.createHmac("sha512", secret).update(rawBody).digest("hex")
      if (computed !== signature) {
        return Response.json({ error: "Invalid signature" }, { status: 401 })
      }
    } else if (secret) {
      return Response.json({ error: "Missing signature" }, { status: 401 })
    }

    let payload: any = {}
    try {
      payload = JSON.parse(rawBody || "{}")
    } catch {
      return Response.json({ error: "Invalid JSON payload" }, { status: 400 })
    }

    const data = payload?.data
    if (!data?.reference) {
      return Response.json({ ok: true })
    }

    const verified = await verifyPaystackTransaction(String(data.reference))
    const verifiedData = verified?.data
    if (!verifiedData) {
      return Response.json({ error: "Unable to verify transaction" }, { status: 400 })
    }

    const result = await syncPaymentFromPaystack({
      id: verifiedData.id,
      reference: verifiedData.reference,
      status: verifiedData.status,
      amount: Number(verifiedData.amount || 0) / 100,
      currency: verifiedData.currency
    })

    return Response.json({ ok: true, result })
  } catch (error) {
    console.error("payments.webhook.error", error)
    return Response.json({ error: "Webhook processing failed." }, { status: 500 })
  }
}
