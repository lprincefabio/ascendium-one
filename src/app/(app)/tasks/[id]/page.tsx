import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, permissionLevelFor } from "@/lib/auth";
import { assertCan } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, DemoBadge, EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { formatDate, formatDateTime, relativeDue } from "@/lib/format";
import { TaskStatusControl } from "@/components/forms";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = (await getCurrentUser())!;
  const level = assertCan(user, "task", "read");
  const { id } = await params;

  const task = await prisma.task.findFirst({
    where: { id, organisationId: user.organisationId, deletedAt: null },
    include: {
      owner: { select: { firstName: true, lastName: true } },
      creator: { select: { firstName: true, lastName: true } },
      project: { select: { id: true, name: true } },
      subsidiary: { select: { name: true } },
      department: { select: { name: true } },
      comments: { include: { author: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!task) notFound();

  const isOwner = task.ownerId === user.id || task.creatorId === user.id;
  const inDept = task.departmentId !== null && task.departmentId === user.departmentId;
  const inSub = task.subsidiaryId !== null && task.subsidiaryId === user.subsidiaryId;
  const visible =
    level === "group" ||
    (level === "subsidiary" && inSub) ||
    (level === "department" && (inDept || isOwner)) ||
    (level === "own" && isOwner);
  if (!visible) notFound();

  const updateLevel = permissionLevelFor(user, "task", "update");
  const canUpdate =
    updateLevel !== null &&
    (updateLevel === "group" ||
      (updateLevel === "subsidiary" && inSub) ||
      (updateLevel === "department" && (inDept || isOwner)) ||
      (updateLevel === "own" && isOwner));

  const due = relativeDue(task.dueDate);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {task.title}
            {task.isDemo && <DemoBadge />}
          </span>
        }
        subtitle={
          <span>
            {task.project && <Link href={`/projects/${task.project.id}`} className="link">{task.project.name}</Link>}
            {task.subsidiary && <> · {task.subsidiary.name}</>}
            {task.department && <> · {task.department.name}</>}
          </span>
        }
        actions={canUpdate ? <TaskStatusControl taskId={task.id} status={task.status} /> : <StatusPill status={task.status} />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</p>
          <p className="mt-1 font-medium text-navy-deep dark:text-white">{task.owner ? `${task.owner.firstName} ${task.owner.lastName}` : "Unassigned"}</p>
        </Card>
        <Card className="p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</p>
          <p className="mt-1"><StatusPill status={task.priority} /></p>
        </Card>
        <Card className="p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due</p>
          <p className={`mt-1 font-medium ${due.overdue ? "text-red-600 dark:text-red-400" : "text-navy-deep dark:text-white"}`}>
            {task.dueDate ? `${formatDate(task.dueDate)} · ${due.label}` : "No deadline"}
          </p>
        </Card>
      </div>

      {task.description && (
        <Card title="Description" className="mt-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{task.description}</p>
        </Card>
      )}

      <Card title="Record" className="mt-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">Created by</dt><dd className="text-navy-deep dark:text-white">{task.creator ? `${task.creator.firstName} ${task.creator.lastName}` : "—"}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">Created</dt><dd className="text-navy-deep dark:text-white">{formatDateTime(task.createdAt)}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">Completed</dt><dd className="text-navy-deep dark:text-white">{task.completedAt ? formatDateTime(task.completedAt) : "—"}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">Approval required</dt><dd className="text-navy-deep dark:text-white">{task.requiresApproval ? (task.approvedAt ? `Approved ${formatDate(task.approvedAt)}` : "Pending") : "No"}</dd></div>
        </dl>
      </Card>

      <Card title={`Comments (${task.comments.length})`} className="mt-4">
        {task.comments.length === 0 ? (
          <EmptyState title="No comments yet" />
        ) : (
          <ul className="space-y-3">
            {task.comments.map((c) => (
              <li key={c.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-white/5">
                <p className="text-xs text-slate-500">{c.author ? `${c.author.firstName} ${c.author.lastName}` : "Unknown"} · {formatDateTime(c.createdAt)}</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-300">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
