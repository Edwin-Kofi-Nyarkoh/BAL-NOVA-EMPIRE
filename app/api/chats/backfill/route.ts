import { prisma } from "@/lib/server/prisma"
import { requireAdmin } from "@/lib/server/api-auth"
import { getClientIp, rateLimit } from "@/lib/server/rate-limit"

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const ip = getClientIp(req)
  const limiter = rateLimit(`chat_backfill:${ip}`, 3, 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }

  const allChats = await prisma.chat.findMany({
    orderBy: { createdAt: "asc" }
  })

  if (!allChats.length) {
    return Response.json({ ok: true, updated: 0, createdThreads: 0 })
  }

  const existingThreads = await prisma.chatThread.findMany({
    orderBy: { createdAt: "asc" }
  })
  const threadMap = new Map<string, string>()
  for (const t of existingThreads) {
    if (t.userId) {
      threadMap.set(t.userId, t.id)
    }
  }

  let createdThreads = 0
  let updated = 0

  for (const chat of allChats) {
    if (chat.threadId) continue

    const userId = chat.userId || null
    let threadId = userId ? threadMap.get(userId) || null : null
    if (!threadId) {
      const thread = await prisma.chatThread.create({
        data: {
          userId,
          status: "open"
        }
      })
      threadId = thread.id
      if (userId) threadMap.set(userId, threadId)
      createdThreads += 1
    }

    await prisma.chat.update({
      where: { id: chat.id },
      data: {
        threadId,
        readByAdmin: chat.role === "admin",
        readByUser: chat.role !== "admin"
      }
    })
    updated += 1
  }

  await prisma.chatThread.updateMany({
    data: { updatedAt: new Date() }
  })

  return Response.json({ ok: true, updated, createdThreads })
}
