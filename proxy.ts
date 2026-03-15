import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

function applySecurityHeaders(res: NextResponse) {
  res.headers.set("X-Content-Type-Options", "nosniff")
  res.headers.set("X-Frame-Options", "DENY")
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)")
  return res
}

export async function proxy(req: Request) {
  const url = new URL(req.url)
  const publicPaths = ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/payment/callback", "/legacy", "/api", "/storefront"]
  const adminOnlyPaths = ["/admin-portal", "/system-config", "/log-history", "/inventory", "/payments", "/admin-messages"]
  if (publicPaths.some((p) => url.pathname.startsWith(p))) {
    return applySecurityHeaders(NextResponse.next())
  }

  const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    const loginUrl = new URL("/login", url.origin)
    loginUrl.searchParams.set("callbackUrl", url.pathname)
    return applySecurityHeaders(NextResponse.redirect(loginUrl))
  }

  if (adminOnlyPaths.some((p) => url.pathname.startsWith(p))) {
    const role = (token as any).role || "user"
    if (role !== "admin") {
      return applySecurityHeaders(NextResponse.redirect(new URL("/", url.origin)))
    }
  }

  return applySecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)"
  ]
}
