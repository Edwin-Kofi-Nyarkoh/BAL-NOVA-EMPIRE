import "dotenv/config"
import http from "node:http"
import { URL } from "node:url"
import { routes } from "../routes"
import { isInternalRequest, userFromAuthHeader } from "./auth"
import { corsHeaders, json, readJsonBody } from "./utils"

const PORT = Number(process.env.PORT || process.env.API_SERVICE_PORT || 8101)

const publicRoutes = new Set([
  "GET /health",
  "POST /auth/login",
  "POST /auth/forgot-password",
  "POST /auth/reset-password"
])

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) return json(res, 400, { error: "Bad request" })

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders())
    return res.end()
  }

  const url = new URL(req.url, "http://localhost")
  const path = url.pathname.replace(/\/+$/g, "") || "/"
  const routeKey = `${req.method} ${path}`

  if (routeKey === "GET /health") {
    return json(res, 200, {
      ok: true,
      status: "healthy",
      service: "api"
    })
  }

  if (!publicRoutes.has(routeKey) && !isInternalRequest(req)) {
    return json(res, 401, { error: "Unauthorized service." })
  }

  const handler = routes[routeKey]
  if (!handler) return json(res, 404, { error: "Not found" })

  const body = req.method === "GET" ? {} : await readJsonBody(req)
  const user = await userFromAuthHeader(req)

  if (!publicRoutes.has(routeKey)) {
    if (!user) return json(res, 401, { error: "Unauthorized" })
    if ((user.approvalStatus || "approved") !== "approved") {
      return json(res, 403, { error: "Account pending approval." })
    }
  }

  try {
    await handler({
      req,
      res,
      path,
      query: url.searchParams,
      body,
      user: user || undefined
    })
  } catch {
    return json(res, 500, { error: "Internal server error." })
  }
})

server.listen(PORT, () => {
  console.log(`BAL API listening on http://localhost:${PORT}`)
})
