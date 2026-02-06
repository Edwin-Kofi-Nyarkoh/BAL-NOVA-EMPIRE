import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"

export const runtime = "nodejs"

function toSse(data: any) {
  return `event: chats\ndata: ${JSON.stringify(data)}\n\n`
}

export async function GET(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const user = auth.session.user as any
  const role = String(user?.role || "user")
  const url = new URL(req.url)
  const threadIdParam = url.searchParams.get("threadId") || ""
  const sinceParam = url.searchParams.get("since") || ""
  let since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 60 * 1000)

  let threadId = threadIdParam
  if (!threadId && role !== "admin") {
    const thread = await prisma.chatThread.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" }
    })
    threadId = thread?.id || ""
  }

  if (!threadId) {
    return new Response("Missing threadId", { status: 400 })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(toSse({ heartbeat: true })))

      const interval = setInterval(async () => {
        try {
          const messages = await prisma.chat.findMany({
            where: {
              threadId,
              createdAt: { gt: since }
            },
            orderBy: { createdAt: "asc" }
          })
          if (messages.length > 0) {
            since = messages[messages.length - 1].createdAt
            controller.enqueue(encoder.encode(toSse({ messages })))
          } else {
            controller.enqueue(encoder.encode(toSse({ heartbeat: true })))
          }
        } catch {
          controller.enqueue(encoder.encode(toSse({ error: "stream_error" })))
        }
      }, 4000)

      req.signal.addEventListener("abort", () => {
        clearInterval(interval)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  })
}
