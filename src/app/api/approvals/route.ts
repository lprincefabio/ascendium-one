import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { permissionLevelFor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const decideSchema = z.object({
  id: z.string(),
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!permissionLevelFor(user, "approval", "approve")) {
    return NextResponse.json({ error: "You do not hold approval authority" }, { status: 403 });
  }

  const parsed = decideSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const approval = await prisma.approval.findFirst({
    where: { id: parsed.data.id, organisationId: user.organisationId, status: "pending" },
  });
  if (!approval) return NextResponse.json({ error: "Approval not found or already decided" }, { status: 404 });
  if (approval.approverId !== user.id && !user.isExecutive && !user.isAdmin) {
    return NextResponse.json({ error: "This approval is addressed to a different authority" }, { status: 403 });
  }

  const updated = await prisma.approval.update({
    where: { id: approval.id },
    data: {
      status: parsed.data.decision,
      approverId: user.id,
      decidedAt: new Date(),
      decisionNote: parsed.data.comment ?? null,
    },
  });

  if (approval.requesterId) {
    await prisma.notification.create({
      data: {
        organisationId: user.organisationId,
        userId: approval.requesterId,
        kind: "approval",
        severity: parsed.data.decision === "approved" ? "info" : "important",
        title: `Your ${approval.kind} request was ${parsed.data.decision}`,
        body: approval.title,
        link: "/approvals",
      },
    });
  }

  await audit(user, {
    action: `approval.${parsed.data.decision}`,
    resourceType: "approval",
    resourceId: approval.id,
    previousValue: { status: "pending" },
    newValue: { status: parsed.data.decision, comment: parsed.data.comment ?? null },
    reason: "Approval decision recorded in Your Decisions inbox",
  });

  return NextResponse.json({ ok: true, status: updated.status });
}
