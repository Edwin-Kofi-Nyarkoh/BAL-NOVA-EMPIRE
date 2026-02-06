import { prisma } from "@/lib/server/prisma"
import bcrypt from "bcryptjs"
import { signMobileToken } from "@/lib/server/mobile-auth"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const email = String(body.email || "").toLowerCase().trim()
  const password = String(body.password || "")

  if (!email || !password) {
    return Response.json({ error: "Email and password are required." }, { status: 400, headers: corsHeaders })
  }

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
