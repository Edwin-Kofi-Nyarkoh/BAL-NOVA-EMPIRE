import { prisma } from "@/lib/server/prisma"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { signMobileToken } from "@/lib/server/mobile-auth"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
}

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200)
})

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const limiter = rateLimit(`mobile_login:${ip}`, 15, 10 * 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429, headers: corsHeaders })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Email and password are required." }, { status: 400, headers: corsHeaders })
  }
  const email = parsed.data.email.toLowerCase().trim()
  const password = parsed.data.password

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return Response.json({ error: "Invalid credentials." }, { status: 401, headers: corsHeaders })
  }
  if (user.approvalStatus && user.approvalStatus !== "approved") {
    return Response.json({ error: "Account pending approval." }, { status: 403, headers: corsHeaders })
  }

  const ok = await bcrypt.compare(password, user.password)
  if (!ok) {
    return Response.json({ error: "Invalid credentials." }, { status: 401, headers: corsHeaders })
  }

  const token = await signMobileToken({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || "user",
    approvalStatus: user.approvalStatus || "approved"
  })

  return Response.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || "user",
      approvalStatus: user.approvalStatus || "approved"
    }
  }, { headers: corsHeaders })
}
