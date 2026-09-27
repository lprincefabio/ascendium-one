import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { assertCan } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const createSchema = z.object({
  title: z.string().min(2).max(300),
  description: z.string().max(5000).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  dueDate: z.string().optional(),
  projectId: z.string().optional(),
  ownerId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const level = assertCan(user, "task", "create");

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid task payload" }, { status: 400 });
  const d = parsed.data;

  const ownerId = d.ownerId ?? user.id;
  if (level === "own" && ownerId !== user.id) {
    return NextResponse.json({ error: "Your role allows creating tasks only for yourself" }, { status: 403 });
  }

  let project = null;
  if (d.projectId) {
    project = await prisma.project.findFirst({ where: { id: d.projectId, organisationId: user.organisationId } });
    if (!project) return NextResponse.json({ error: "Project not found in your organisation" }, { status: 404 });
    if (level !== "group" && project.subsidiaryId && project.subsidiaryId !== user.subsidiaryId) {
      return NextResponse.json({ error: "Project is outside your subsidiary scope" }, { status: 403 });
    }
  }

  const task = await prisma.task.create({
    data: {
      organisationId: user.organisationId,
      title: d.title,
      description: d.description ?? null,
      priority: d.priority,
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      projectId: project?.id ?? null,
      subsidiaryId: project?.subsidiaryId ?? user.subsidiaryId ?? null,
      departmentId: user.departmentId,
      ownerId,
      creatorId: user.id,
      status: "todo",
      isDemo: false,
    },
  });

  if (ownerId !== user.id) {
    await prisma.notification.create({
      data: {
        organisationId: user.organisationId,
        userId: ownerId,
        kind: "task",
        severity: "important",
        title: `New task assigned: ${task.title}`,
        link: "/tasks",
      },
    });
  }

  await audit(user, { action: "task.create", resourceType: "task", resourceId: task.id, newValue: { title: task.title }, reason: "Task created via Ascendium One" });
  return NextResponse.json({ ok: true, id: task.id });
}

const updateSchema = z.object({
  id: z.string(),
  status: z.enum(["todo", "in_progress", "blocked", "review", "done", "cancelled"]).optional(),
  title: z.string().min(2).max(300).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  dueDate: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const level = assertCan(user, "task", "update");

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid task payload" }, { status: 400 });
  const d = parsed.data;

  const task = await prisma.task.findFirst({ where: { id: d.id, organisationId: user.organisationId } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const isOwner = task.ownerId === user.id || task.creatorId === user.id;
  const inDept = task.departmentId !== null && task.departmentId === user.departmentId;
  const inSub = task.subsidiaryId !== null && task.subsidiaryId === user.subsidiaryId;
  const allowed =
    level === "group" ||
    (level === "subsidiary" && inSub) ||
    (level === "department" && (inDept || isOwner)) ||
    (level === "own" && isOwner);
  if (!allowed) return NextResponse.json({ error: "Task is outside your scope" }, { status: 403 });

  const updated = await prisma.task.update({
    where: { id: task.id },
    data: {
      ...(d.status ? { status: d.status, completedAt: d.status === "done" ? new Date() : task.completedAt } : {}),
      ...(d.title ? { title: d.title } : {}),
      ...(d.priority ? { priority: d.priority } : {}),
      ...(d.dueDate !== undefined ? { dueDate: d.dueDate ? new Date(d.dueDate) : null } : {}),
    },
  });

  await audit(user, { action: "task.update", resourceType: "task", resourceId: task.id, previousValue: { status: task.status }, newValue: { status: updated.status }, reason: "Task updated" });
  return NextResponse.json({ ok: true, status: updated.status });
}
