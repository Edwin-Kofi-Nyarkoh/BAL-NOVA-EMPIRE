import { SignJWT, jwtVerify } from "jose"

type MobileTokenUser = {
  id: string
  name?: string | null
  email?: string | null
  role?: string
  approvalStatus?: string
}

const SECRET =
  process.env.MOBILE_AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET

if (!SECRET) {
  throw new Error("Missing MOBILE_AUTH_SECRET (or NEXTAUTH_SECRET) for mobile token signing.")
}

const SECRET_KEY = new TextEncoder().encode(SECRET)

export async function signMobileToken(user: MobileTokenUser) {
  return new SignJWT({
    name: user.name || null,
    email: user.email || null,
    role: user.role || "user",
    approvalStatus: user.approvalStatus || "approved"
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(SECRET_KEY)
}

export async function verifyMobileToken(token: string) {
  const { payload } = await jwtVerify(token, SECRET_KEY)
  return payload
}
