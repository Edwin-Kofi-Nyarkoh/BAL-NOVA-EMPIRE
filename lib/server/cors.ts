export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
}

export function applyCors(res: Response) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.headers.set(key, value)
  })
  return res
}
