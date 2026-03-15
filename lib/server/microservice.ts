type ProxyMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS"

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "")
}

export function microserviceUrl(service: string, path = "") {
  const base = process.env.BACKEND_GATEWAY_URL || ""
  if (!base) return ""
  const cleanedBase = base.replace(/\/+$/, "")
  const servicePart = trimSlashes(service)
  const pathPart = trimSlashes(path)
  return `${cleanedBase}/${servicePart}${pathPart ? `/${pathPart}` : ""}`
}

export async function proxyToMicroservice(
  req: Request,
  service: string,
  path = "",
  method?: ProxyMethod,
  extraHeaders?: Record<string, string>
) {
  const target = microserviceUrl(service, path)
  if (!target) return null
  const requestMethod = method || (req.method as ProxyMethod)
  const res = await fetch(target, {
    method: requestMethod,
    headers: {
      "Content-Type": "application/json",
      Authorization: req.headers.get("authorization") || "",
      "x-service-client-key": process.env.SERVICE_CLIENT_KEY || "",
      ...(extraHeaders || {})
    },
    body: requestMethod === "GET" || requestMethod === "OPTIONS" ? undefined : await req.text(),
    cache: "no-store"
  })
  const text = await res.text()
  const contentType = res.headers.get("content-type") || "application/json"
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": contentType }
  })
}
