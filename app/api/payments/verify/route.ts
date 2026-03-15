import { verifyPaystackTransaction } from "@/lib/server/paystack"
import { syncPaymentFromPaystack } from "@/lib/server/payments"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"

function isValidReference(value: string) {
  return /^[a-zA-Z0-9._-]{6,128}$/.test(value)
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const reference = url.searchParams.get("reference") || url.searchParams.get("tx_ref") || ""

    if (!reference) {
      return Response.json({ error: "Missing transaction reference" }, { status: 400 })
    }
    if (!isValidReference(reference)) {
      return Response.json({ error: "Invalid transaction reference" }, { status: 400 })
    }

    const ip = getClientIp(req)
    const limiter = rateLimit(`pay_verify:${ip}`, 30, 60 * 1000)
    if (!limiter.ok) {
      return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
    }

    const verified = await verifyPaystackTransaction(reference)
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
    console.error("payments.verify.error", error)
    return Response.json({ error: "Unable to verify payment." }, { status: 502 })
  }
}
