import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { assertCan } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const createSchema = z.object({
  title: z.string().min(3).max(300),
  context: z.string().max(5000).optional(),
  problem: z.string().max(5000).optional(),
  options: z.string().max(5000).optional(),
  recommendation: z.string().max(5000).optional(),
  financialImplication: z.string().max(2000).optional(),
  riskAssessment: z.string().max(2000).optional(),
  decisionDeadline: z.string().optional(),
  subsidiaryId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const level = assertCan(user, "decision", "create");

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid decision payload" }, { status: 400 });
  const d = parsed.data;

  if (d.subsidiaryId && level !== "group" && d.subsidiaryId !== user.subsidiaryId) {
    return NextResponse.json({ error: "Subsidiary outside your scope" }, { status: 403 });
  }

  const decision = await prisma.decision.create({
    data: {
      organisationId: user.organisationId,
      title: d.title,
      context: d.context,
      problem: d.problem,
      options: d.options,
      recommendation: d.recommendation ?? null,
      financialImplication: d.financialImplication ?? null,
      riskAssessment: d.riskAssessment ?? null,
      deadline: d.decisionDeadline ? new Date(d.decisionDeadline) : null,
      subsidiaryId: d.subsidiaryId ?? user.subsidiaryId ?? null,
      departmentId: user.departmentId,
      ownerId: user.id,
      status: "open",
      isDemo: false,
    },
  });

  await audit(user, { action: "decision.create", resourceType: "decision", resourceId: decision.id, newValue: { title: decision.title }, reason: "Decision framed in Decision Room" });
  return NextResponse.json({ ok: true, id: decision.id });
}
