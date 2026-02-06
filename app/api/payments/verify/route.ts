import { verifyPaystackTransaction } from "@/lib/server/paystack"
import { syncPaymentFromPaystack } from "@/lib/server/payments"

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const reference = url.searchParams.get("reference") || url.searchParams.get("tx_ref") || ""

    if (!reference) {
      return Response.json({ error: "Missing transaction reference" }, { status: 400 })
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
