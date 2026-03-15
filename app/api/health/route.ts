import { prisma } from "@/lib/server/prisma"
import { applyCors, corsHeaders } from "@/lib/server/cors"
import { proxyToMicroservice } from "@/lib/server/microservice"

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: Request) {
  const proxied = await proxyToMicroservice(req, "api", "health", "GET").catch(() => null)
  if (proxied) return applyCors(proxied)

  let db = "ok"
  let error = ""
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    db = "error"
    error = "Database connection failed."
  }

  const res = Response.json({
    ok: db === "ok",
    status: db === "ok" ? "healthy" : "degraded",
    db,
    error
  }, { headers: corsHeaders })
  return applyCors(res)
}
