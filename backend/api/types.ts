import http from "node:http"

export type RouteContext = {
  req: http.IncomingMessage
  res: http.ServerResponse
  path: string
  query: URLSearchParams
  body: unknown
  user?: AuthUser
}

export type RouteHandler = (ctx: RouteContext) => Promise<void> | void

export type AuthUser = {
  id: string
  email?: string | null
  name?: string | null
  role: string
  approvalStatus: string
}
