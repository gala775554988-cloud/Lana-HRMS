import { prisma } from "@/lib/prisma";

type AuditInput = {
  actorUserId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

type AuditDelegate = {
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
};

export async function writeAuditLog(input: AuditInput) {
  const client = prisma as unknown as { auditLog: AuditDelegate };
  await client.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: input.metadata
    }
  });
}
