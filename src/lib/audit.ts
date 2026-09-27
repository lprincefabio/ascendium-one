import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

type AuditInput = {
  action: string;
  resourceType?: string;
  resourceId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
  ip?: string | null;
};

/** Writes an immutable audit record for any consequential action. */
export async function audit(
  user: SessionUser | { organisationId: string; id?: string | null; email?: string | null },
  input: AuditInput
): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      organisationId: user.organisationId,
      actorId: "id" in user && user.id ? user.id : null,
      actorEmail: "email" in user && user.email ? user.email : null,
      action: input.action,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      previousValue: input.previousValue === undefined ? null : JSON.stringify(input.previousValue),
      newValue: input.newValue === undefined ? null : JSON.stringify(input.newValue),
      reason: input.reason ?? null,
      ip: input.ip ?? null,
    },
  });
}
