import { prisma } from "@/lib/server/prisma"
import { requireUser } from "@/lib/server/api-auth"
import { logAuditEvent } from "@/lib/server/audit"
import { applyCors, corsHeaders } from "@/lib/server/cors"

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return applyCors(auth.response)
  const user = auth.session.user as any
  const role = String(user?.role || "user")
  const url = new URL(req.url)
  const view = url.searchParams.get("view") || ""
  const threadId = url.searchParams.get("threadId") || ""

  if (role === "admin" && view === "threads") {
    const threads = await prisma.chatThread.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    })
    const unread = await prisma.chat.groupBy({
      by: ["threadId"],
      where: { role: "user", readByAdmin: false },
      _count: { _all: true }
    })
    const unreadMap = new Map(unread.map((u) => [u.threadId, u._count._all]))
    const data = threads.map((t) => ({
      id: t.id,
      status: t.status,
      updatedAt: t.updatedAt,
      user: t.user,
      lastMessage: t.messages[0] || null,
      unreadCount: unreadMap.get(t.id) || 0
    }))
    return Response.json({ threads: data }, { headers: corsHeaders })
  }

  if (role === "admin" && threadId) {
    const chats = await prisma.chat.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" }
    })
    return Response.json({ chats }, { headers: corsHeaders })
  }

  const thread = await prisma.chatThread.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" }
  })
  if (!thread) return Response.json({ chats: [] }, { headers: corsHeaders })
  const chats = await prisma.chat.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "asc" }
  })
  return Response.json({ chats }, { headers: corsHeaders })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return applyCors(auth.response)
  const user = auth.session.user as any
  const role = String(user?.role || "user")
  const body = await req.json().catch(() => ({}))
  const chats = Array.isArray(body.chats) ? body.chats : null
  const chat = body.chat

  if (chats) {
    const validChats = chats
      .map((c: any) => ({
        role: String(c?.role || "user"),
        text: String(c?.text || "").trim()
      }))
      .filter((c: any) => c.text.length > 0)

    if (!validChats.length) {
      return Response.json({ error: "No valid chats provided" }, { status: 400, headers: corsHeaders })
    }

    const thread = await prisma.chatThread.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" }
    })
    if (!thread) {
      return Response.json({ error: "Chat thread not found" }, { status: 400, headers: corsHeaders })
    }

    await prisma.chat.createMany({
      data: validChats.map((c: any) => ({
        role: c.role,
        text: c.text,
        userId: user.id,
        threadId: thread.id,
        readByAdmin: c.role === "admin",
        readByUser: c.role !== "admin"
      }))
    })
    await prisma.chatThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() }
    })
    await logAuditEvent({
      actor: auth.session.user,
      action: "chats.bulk_create",
      entityType: "Chat",
      metadata: { count: validChats.length }
    })
  } else if (chat) {
    const text = String(chat?.text || "").trim()
    if (!text) {
      return Response.json({ error: "Chat text is required" }, { status: 400, headers: corsHeaders })
    }
    const incomingRole = String(chat.role || "user")
    const isAdminSend = role === "admin" && incomingRole === "admin"
    const targetThreadId = String(chat.threadId || "")
    let threadId = targetThreadId
    let thread = targetThreadId
      ? await prisma.chatThread.findUnique({ where: { id: targetThreadId } })
      : null
    if (isAdminSend && !thread) {
      return Response.json({ error: "Thread not found" }, { status: 404, headers: corsHeaders })
    }
    if (!thread && !isAdminSend) {
      thread = await prisma.chatThread.findFirst({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" }
      })
      if (!thread) {
        thread = await prisma.chatThread.create({
          data: { userId: user.id, status: "open" }
        })
      }
      threadId = thread.id
    }
    if (isAdminSend && !threadId) {
      return Response.json({ error: "threadId is required for admin replies" }, { status: 400, headers: corsHeaders })
    }

    await prisma.chat.create({
      data: {
        role: incomingRole,
        text,
        userId: isAdminSend ? thread?.userId || null : user.id,
        threadId: threadId || null,
        readByAdmin: isAdminSend,
        readByUser: !isAdminSend
      }
    })
    if (threadId) {
      await prisma.chatThread.update({
        where: { id: threadId },
        data: { updatedAt: new Date(), status: "open" }
      })
    }
    await logAuditEvent({
      actor: auth.session.user,
      action: "chats.create",
      entityType: "Chat",
      metadata: { role: chat.role || "user" }
    })
  } else {
    return Response.json({ error: "Invalid payload" }, { status: 400, headers: corsHeaders })
  }

  let newChats: any[] = []
  if (role === "admin") {
    newChats = await prisma.chat.findMany({ orderBy: { createdAt: "desc" } })
  } else {
    const thread = await prisma.chatThread.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" }
    })
    if (thread) {
      newChats = await prisma.chat.findMany({
        where: { threadId: thread.id },
        orderBy: { createdAt: "asc" }
      })
    }
  }
  return Response.json({ chats: newChats }, { headers: corsHeaders })
}

export async function PATCH(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return applyCors(auth.response)
  const user = auth.session.user as any
  const role = String(user?.role || "user")
  if (role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders })
  }
  const body = await req.json().catch(() => ({}))
  const threadId = String(body.threadId || "")
  if (!threadId) {
    return Response.json({ error: "threadId required" }, { status: 400, headers: corsHeaders })
  }
  if (body.status) {
    await prisma.chatThread.update({
      where: { id: threadId },
      data: { status: String(body.status) }
    })
  }
  if (body.markRead) {
    await prisma.chat.updateMany({
      where: { threadId, role: "user", readByAdmin: false },
      data: { readByAdmin: true }
    })
  }
  return Response.json({ ok: true }, { headers: corsHeaders })
}
