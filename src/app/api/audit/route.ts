import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { assertCan } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  assertCan(user, "audit", "read");
  const events = await prisma.auditEvent.findMany({
    where: { organisationId: user.organisationId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(events);
}
