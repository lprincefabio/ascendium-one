import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { assertCan } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  assertCan(user, "admin", "administer");
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const users = await prisma.user.findMany({
    where: {
      organisationId: user.organisationId,
      ...(q ? { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { email: { contains: q } }] } : {}),
    },
    orderBy: [{ isActive: "desc" }, { lastName: "asc" }],
    take: 100,
    select: {
      id: true, email: true, firstName: true, lastName: true, title: true, isActive: true, isExecutive: true, isAdmin: true, isDemo: true,
      role: { select: { name: true, code: true } },
      subsidiary: { select: { name: true } },
      department: { select: { name: true } },
      lastLoginAt: true, createdAt: true,
    },
  });
  return NextResponse.json(users);
}

const patchSchema = z.object({ id: z.string(), isActive: z.boolean() });

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  assertCan(user, "admin", "administer");

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (parsed.data.id === user.id) return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });

  const target = await prisma.user.findFirst({ where: { id: parsed.data.id, organisationId: user.organisationId } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.user.update({ where: { id: target.id }, data: { isActive: parsed.data.isActive } });
  if (!parsed.data.isActive) {
    await prisma.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  await audit(user, {
    action: parsed.data.isActive ? "admin.user.activate" : "admin.user.deactivate",
    resourceType: "user",
    resourceId: target.id,
    previousValue: { isActive: target.isActive },
    newValue: { isActive: parsed.data.isActive },
    reason: "User account status changed from Administration console",
  });
  return NextResponse.json({ ok: true });
}
