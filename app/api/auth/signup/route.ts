import { prisma } from "@/lib/server/prisma"
import bcrypt from "bcryptjs"
import { getServerSession } from "next-auth/next"
import { authConfig } from "@/lib/auth"
import { logAuditEvent } from "@/lib/server/audit"
import { notifyPartnerSignup } from "@/lib/server/notifications"
import { Prisma } from "../../../../generated/prisma"
import { z } from "zod"
import { getClientIp, rateLimitSecure } from "@/lib/server/rate-limit"

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const limiter = await rateLimitSecure(`signup:${ip}`, 10, 10 * 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const schema = z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().email().max(190),
    password: z.string().min(8).max(128),
    role: z.string().optional(),
    artisanOnboarding: z.object({
      track: z.enum(["individual", "corporate"]),
      legalName: z.string().trim().max(160).optional(),
      phone: z.string().trim().max(40).optional(),
      ghanaCardNumber: z.string().trim().max(60).optional(),
      ghanaCardFrontUrl: z.string().trim().max(500).optional(),
      ghanaCardBackUrl: z.string().trim().max(500).optional(),
      livenessSelfieUrl: z.string().trim().max(500).optional(),
      guarantorName: z.string().trim().max(160).optional(),
      guarantorPhone: z.string().trim().max(40).optional(),
      guarantorIdNumber: z.string().trim().max(80).optional(),
      primaryTrade: z.string().trim().max(100).optional(),
      subSpecialties: z.array(z.string().trim().max(80)).max(12).optional(),
      operationalBase: z.string().trim().max(220).optional(),
      momoNumber: z.string().trim().max(40).optional(),
      payoutAccountName: z.string().trim().max(160).optional(),
      headshotUrl: z.string().trim().max(500).optional(),
      diagnosticFee: z.coerce.number().min(0).max(100000).optional(),
      bio: z.string().trim().max(250).optional(),
      workPhotos: z.array(z.string().trim().max(500)).max(10).optional(),
      companyName: z.string().trim().max(180).optional(),
      rgdCertificateUrl: z.string().trim().max(500).optional(),
      directorCardUrl: z.string().trim().max(500).optional(),
      corporateTin: z.string().trim().max(80).optional(),
      officeLocation: z.string().trim().max(220).optional(),
      technicianCount: z.coerce.number().int().min(1).max(10000).optional(),
      tradeCategories: z.array(z.string().trim().max(80)).max(12).optional(),
      payoutAccount: z.string().trim().max(160).optional(),
      logoUrl: z.string().trim().max(500).optional()
    }).optional()
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })
  }

  const name = parsed.data.name
  const email = parsed.data.email.toLowerCase().trim()
  const password = parsed.data.password
  const role = String(parsed.data.role || "user")
  const session = await getServerSession(authConfig)

  const sessionRole = (session?.user as any)?.role || "user"
  const partnerRoles = new Set(["vendor", "rider", "reseller", "pro"])
  const publicRoles = new Set(["user", ...partnerRoles])

  let finalRole = "user"
  if (sessionRole === "admin") {
    finalRole = role || "user"
  } else {
    finalRole = publicRoles.has(role) ? role : "user"
  }

  const approvalStatus = sessionRole === "admin" || finalRole === "user" ? "approved" : "pending"

  const passwordHash = await bcrypt.hash(password, 10)
  let created
  try {
    const artisan = finalRole === "pro" ? parsed.data.artisanOnboarding : undefined
    if (finalRole === "pro" && !artisan?.track) {
      return Response.json({ error: "Artisan signup requires the verification packet." }, { status: 400 })
    }

    created = await prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
        role: finalRole,
        approvalStatus,
        approvedAt: approvalStatus === "approved" ? new Date() : null,
        approvedById: approvalStatus === "approved" && sessionRole === "admin" ? (session?.user as any)?.id : null,
        ...(artisan
          ? {
              artisanOnboarding: {
                create: {
                  track: artisan.track,
                  status: approvalStatus === "approved" ? "active" : "pending",
                  legalName: artisan.legalName || name,
                  phone: artisan.phone || null,
                  ghanaCardNumber: artisan.ghanaCardNumber || null,
                  ghanaCardFrontUrl: artisan.ghanaCardFrontUrl || null,
                  ghanaCardBackUrl: artisan.ghanaCardBackUrl || null,
                  livenessSelfieUrl: artisan.livenessSelfieUrl || null,
                  guarantorName: artisan.guarantorName || null,
                  guarantorPhone: artisan.guarantorPhone || null,
                  guarantorIdNumber: artisan.guarantorIdNumber || null,
                  primaryTrade: artisan.primaryTrade || null,
                  subSpecialties: artisan.subSpecialties || [],
                  operationalBase: artisan.operationalBase || null,
                  momoNumber: artisan.momoNumber || null,
                  payoutAccountName: artisan.payoutAccountName || null,
                  headshotUrl: artisan.headshotUrl || null,
                  diagnosticFee: Number(artisan.diagnosticFee ?? (artisan.track === "corporate" ? 150 : 50)),
                  bio: artisan.bio || null,
                  workPhotos: artisan.workPhotos || [],
                  companyName: artisan.companyName || null,
                  rgdCertificateUrl: artisan.rgdCertificateUrl || null,
                  directorCardUrl: artisan.directorCardUrl || null,
                  corporateTin: artisan.corporateTin || null,
                  officeLocation: artisan.officeLocation || null,
                  technicianCount: artisan.technicianCount || null,
                  tradeCategories: artisan.tradeCategories || [],
                  payoutAccount: artisan.payoutAccount || null,
                  logoUrl: artisan.logoUrl || null,
                  commissionRate: 0.1
                }
              },
              proPortfolio: {
                create: {
                  summary: artisan.bio || `${artisan.primaryTrade || "Service Pro"} awaiting Bal Nova approval.`
                }
              }
            }
          : {})
      }
    })
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: "Email already registered" }, { status: 409 })
    }
    if (error?.code === "ETIMEDOUT") {
      return Response.json({ error: "Database connection timed out" }, { status: 503 })
    }
    return Response.json({ error: "Signup failed" }, { status: 500 })
  }

  await logAuditEvent({
    actor: session?.user,
    action: "users.create",
    entityType: "User",
    entityId: created.id,
    metadata: { role: finalRole, email, approvalStatus }
  })

  if (approvalStatus === "pending") {
    await notifyPartnerSignup({ email, name, role: finalRole })
  }

  return Response.json({
    ok: true,
    approvalStatus,
    message:
      approvalStatus === "pending"
        ? "Account submitted for approval. You will be notified once approved."
        : "Account created."
  })
}
