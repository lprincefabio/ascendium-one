import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { assertCan, scopeWhere, peopleScopeWhere } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, EmptyState, PageHeader, Pill, StatusPill, Table, RowLink } from "@/components/ui";
import { formatDate, relativeDue } from "@/lib/format";
import { TaskCreateForm } from "@/components/forms";

export const dynamic = "force-dynamic";

const STATUSES = ["todo", "in_progress", "blocked", "review", "done"] as const;

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = (await getCurrentUser())!;
  const level = assertCan(user, "task", "read");
  const { status } = await searchParams;

  const scope = scopeWhere(user, "task", "read") as Prisma.TaskWhereInput;
  const [tasks, projects, people] = await Promise.all([
    prisma.task.findMany({
      where: {
        organisationId: user.organisationId,
        deletedAt: null,
        ...scope,
        ...(status && (STATUSES as readonly string[]).includes(status) ? { status } : { status: { not: "cancelled" } }),
      },
      include: {
        owner: { select: { firstName: true, lastName: true } },
        project: { select: { name: true } },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      take: 200,
    }),
    prisma.project.findMany({
      where: { organisationId: user.organisationId, deletedAt: null, ...(scopeWhere(user, "project", "read") as Prisma.ProjectWhereInput) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    prisma.user.findMany({
      where: { organisationId: user.organisationId, isActive: true, ...(peopleScopeWhere(user) as Prisma.UserWhereInput) },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }],
      take: 200,
    }),
  ]);

  const openCount = tasks.filter((t) => t.status !== "done").length;

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle={`${openCount} open in your scope${level !== "group" ? ` · visibility: ${level}` : ""}`}
        actions={<TaskCreateForm projects={projects} people={people.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }))} canAssignOthers={level !== "own"} />}
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/tasks" className={`rounded-full px-3 py-1 text-xs font-medium ${!status ? "bg-navy-deep text-gold dark:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300"}`}>All open</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/tasks?status=${s}`} className={`rounded-full px-3 py-1 text-xs font-medium ${status === s ? "bg-navy-deep text-gold dark:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300"}`}>
            {s.replace("_", " ")}
          </Link>
        ))}
      </div>

      <Card>
        {tasks.length === 0 ? (
          <EmptyState title="No tasks in your scope" hint="Create your first task with the New task button." />
        ) : (
          <Table head={["Task", "Project", "Owner", "Priority", "Status", "Due"]}>
            {tasks.map((t) => {
              const due = relativeDue(t.dueDate);
              return (
                <RowLink
                  key={t.id}
                  href={`/tasks/${t.id}`}
                  cells={[
                    <span key="t" className="flex items-center gap-2">
                      {t.title}
                      {t.isDemo && <Pill tone="gold">demo</Pill>}
                    </span>,
                    <span key="p" className="text-slate-500 dark:text-slate-400">{t.project?.name ?? "—"}</span>,
                    <span key="o" className="text-slate-600 dark:text-slate-300">{t.owner ? `${t.owner.firstName} ${t.owner.lastName}` : "Unassigned"}</span>,
                    <StatusPill key="pr" status={t.priority} />,
                    <StatusPill key="s" status={t.status} />,
                    <span key="d" className={due.overdue ? "font-medium text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-300"}>
                      {t.dueDate ? due.label : formatDate(null)}
                    </span>,
                  ]}
                />
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}
