import { prisma } from "@/lib/server/prisma"
import { Prisma } from "@prisma/client"

type Actor = {
  id?: string | null
  email?: string | null
}

export async function logAuditEvent(params: {
  actor?: Actor | null
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Record<string, unknown> | null
}) {
  const { actor, action, entityType, entityId, metadata } = params
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor?.id || null,
        actorEmail: actor?.email || null,
        action,
        entityType,
        entityId: entityId || null,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined
      }
    })
  } catch {
    // Audit logging should never block core flows.
  }
}
