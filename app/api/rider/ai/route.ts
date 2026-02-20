import { requireRider } from "@/lib/server/api-auth"
import { prisma } from "@/lib/server/prisma"
import { z } from "zod"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"

type AiBody = {
  type?: "brief" | "comms"
  scenario?: string
}

function buildPrompt(type: "brief" | "comms", scenario: string, context: string) {
  if (type === "comms") {
    return `You are an AI assistant for a delivery rider. Generate a short message to a customer.\nContext: ${context}\nScenario: ${scenario}\nTone: Professional, efficient, slightly futuristic. Max 200 characters.`
  }
  return `You are 'Empire', a cyberpunk city dispatch AI. ${context}\nGive a short tactical status report (max 2 sentences). Be cool and efficient. If load is high (>80%), warn about maneuverability.`
}

export async function POST(req: Request) {
  const auth = await requireRider()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`rider_ai:${ip}`, 20, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests" }, { status: 429 })
  }
  const userId = (auth.session.user as any).id as string
  const body = (await req.json().catch(() => ({}))) as AiBody
  const schema = z.object({
    type: z.enum(["brief", "comms"]).optional(),
    scenario: z.string().max(300).optional()
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 })
  }
  const type = parsed.data.type === "comms" ? "comms" : "brief"

  const apiKey = process.env.GEMINI_API_KEY || ""
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash"
  if (!apiKey) {
    return Response.json({ error: "AI is not configured" }, { status: 400 })
  }

  const state = await prisma.riderState.findUnique({ where: { userId } })
  const tasks = await prisma.riderTask.findMany({ where: { userId } })
  const activeCount = tasks.filter((t) => t.status !== "done").length
  const context = `Rider ${auth.session.user?.name || "Rider"} in ${state?.currentSector || "CITY_CORE"}.\nStats: ${state?.currentVol || 0}% load, GHS ${state?.pendingCash?.toFixed?.(2) || "0.00"} yield, ${activeCount} active missions.`
  const prompt = buildPrompt(type, parsed.data.scenario || "Status update", context)

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  )

  if (!response.ok) {
    return Response.json({ error: "AI request failed" }, { status: 502 })
  }

  const data = await response.json().catch(() => ({}))
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "Signal lost. Check AI connectivity."
  return Response.json({ text })
}
