import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { assertCan } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const schema = z.object({
  title: z.string().min(3).max(300),
  body: z.string().min(3).max(10000),
  audience: z.enum(["group", "cluster", "subsidiary", "department"]).default("group"),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  assertCan(user, "announcement", "create");

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid announcement payload" }, { status: 400 });
  const d = parsed.data;

  if (d.audience !== "group" && !user.subsidiaryId && !user.departmentId) {
    return NextResponse.json({ error: "No organisational scope for this audience" }, { status: 400 });
  }

  const announcement = await prisma.announcement.create({
    data: {
      organisationId: user.organisationId,
      authorId: user.id,
      title: d.title,
      body: d.body,
      audience: d.audience,
      audienceId: d.audience === "subsidiary" ? user.subsidiaryId : d.audience === "department" ? user.departmentId : null,
      isDemo: false,
    },
  });

  const audienceWhere =
    d.audience === "group"
      ? { organisationId: user.organisationId, isActive: true }
      : d.audience === "subsidiary"
        ? { organisationId: user.organisationId, isActive: true, subsidiaryId: user.subsidiaryId }
        : { organisationId: user.organisationId, isActive: true, departmentId: user.departmentId };

  const recipients = await prisma.user.findMany({ where: audienceWhere, select: { id: true } });
  await prisma.notification.createMany({
    data: recipients
      .filter((r) => r.id !== user.id)
      .map((r) => ({
        organisationId: user.organisationId,
        userId: r.id,
        kind: "announcement",
        severity: "info" as const,
        title: `Announcement: ${announcement.title}`,
        link: "/announcements",
      })),
  });

  await audit(user, {
    action: "announcement.publish",
    resourceType: "announcement",
    resourceId: announcement.id,
    newValue: { title: announcement.title, audience: d.audience },
    reason: "Announcement published",
  });
  return NextResponse.json({ ok: true, id: announcement.id });
}
