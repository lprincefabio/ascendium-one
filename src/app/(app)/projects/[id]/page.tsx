import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { assertCan } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, DemoBadge, EmptyState, HealthDot, PageHeader, Pill, ProgressBar, StatusPill, Table, RowLink } from "@/components/ui";
import { formatCurrency, formatDate, relativeDue } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = (await getCurrentUser())!;
  assertCan(user, "project", "read");
  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, organisationId: user.organisationId, deletedAt: null },
    include: {
      subsidiary: { select: { name: true, slug: true } },
      department: { select: { name: true } },
      members: { include: { user: { select: { firstName: true, lastName: true, title: true } } }, take: 20 },
      tasks: { where: { deletedAt: null }, include: { owner: { select: { firstName: true, lastName: true } } }, orderBy: [{ status: "asc" }, { dueDate: "asc" }], take: 30 },
      risks: { where: { status: { in: ["open", "mitigating"] } }, take: 10 },
      decisions: { orderBy: { createdAt: "desc" }, take: 10 },
      meetings: { orderBy: { startsAt: "desc" }, take: 10 },
      documents: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 10 },
    },
  });
  if (!project) notFound();

  const spentPct = project.budgetCents > 0n ? Math.round(Number((project.spentCents * 100n) / project.budgetCents)) : 0;

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {project.name}
            {project.isDemo && <DemoBadge />}
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2">
            {project.code && <Pill tone="slate">{project.code}</Pill>}
            <StatusPill status={project.status} />
            <HealthDot health={project.health} />
            {project.subsidiary && <Link href={`/subsidiaries/${project.subsidiary.slug}`} className="link">{project.subsidiary.name}</Link>}
            {project.department && <span>· {project.department.name}</span>}
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Progress</p>
          <p className="font-display mt-1 text-2xl font-semibold text-navy-deep dark:text-white">{project.progressPct}%</p>
          <div className="mt-2"><ProgressBar value={project.progressPct} tone={project.health === "red" ? "red" : project.health === "amber" ? "amber" : "green"} /></div>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Budget</p>
          <p className="font-display mt-1 text-2xl font-semibold text-navy-deep dark:text-white">{formatCurrency(project.budgetCents)}</p>
          <p className="mt-1 text-xs text-slate-500">{spentPct}% spent ({formatCurrency(project.spentCents)})</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Timeline</p>
          <p className="font-display mt-1 text-2xl font-semibold text-navy-deep dark:text-white">{formatDate(project.dueDate)}</p>
          <p className="mt-1 text-xs text-slate-500">{relativeDue(project.dueDate).label} · started {formatDate(project.startDate)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</p>
          <p className="font-display mt-1 text-2xl font-semibold text-navy-deep dark:text-white capitalize">{project.priority}</p>
        </Card>
      </div>

      {project.description && (
        <Card title="About" className="mt-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{project.description}</p>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title={`Tasks (${project.tasks.length})`} action={<Link href="/tasks" className="link text-xs">All tasks</Link>}>
          {project.tasks.length === 0 ? (
            <EmptyState title="No tasks on this project" />
          ) : (
            <Table head={["Task", "Owner", "Status", "Due"]}>
              {project.tasks.map((t) => (
                <RowLink
                  key={t.id}
                  href={`/tasks/${t.id}`}
                  cells={[
                    t.title,
                    <span key="o" className="text-slate-600 dark:text-slate-300">{t.owner ? `${t.owner.firstName} ${t.owner.lastName}` : "—"}</span>,
                    <StatusPill key="s" status={t.status} />,
                    <span key="d" className="text-slate-600 dark:text-slate-300">{formatDate(t.dueDate)}</span>,
                  ]}
                />
              ))}
            </Table>
          )}
        </Card>

        <Card title={`Open risks (${project.risks.length})`} action={<Link href="/risks" className="link text-xs">Risk register</Link>}>
          {project.risks.length === 0 ? (
            <EmptyState title="No open risks on this project" />
          ) : (
            <ul className="space-y-2">
              {project.risks.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-white/5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-navy-deep dark:text-white">{r.title}</span>
                    <span className="text-xs capitalize text-slate-500">{r.category}</span>
                  </span>
                  <Pill tone={r.probability * r.impact >= 12 ? "red" : r.probability * r.impact >= 6 ? "amber" : "slate"}>score {r.probability * r.impact}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title={`Decisions (${project.decisions.length})`} action={<Link href="/decisions" className="link text-xs">Decision Room</Link>}>
          {project.decisions.length === 0 ? (
            <EmptyState title="No decisions linked to this project" />
          ) : (
            <ul className="space-y-2">
              {project.decisions.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-white/5">
                  <span className="min-w-0 flex-1 truncate font-medium text-navy-deep dark:text-white">{d.title}</span>
                  <StatusPill status={d.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Members (${project.members.length})`}>
          <ul className="space-y-2">
            {project.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between text-sm">
                <span className="font-medium text-navy-deep dark:text-white">{m.user.firstName} {m.user.lastName}</span>
                <span className="text-xs capitalize text-slate-500">{m.role}{m.user.title ? ` · ${m.user.title}` : ""}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {(project.meetings.length > 0 || project.documents.length > 0) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card title="Meetings">
            <ul className="space-y-2 text-sm">
              {project.meetings.map((m) => (
                <li key={m.id} className="flex items-center justify-between">
                  <span className="font-medium text-navy-deep dark:text-white">{m.title}</span>
                  <span className="text-xs text-slate-500">{formatDate(m.startsAt)}</span>
                </li>
              ))}
              {project.meetings.length === 0 && <li className="text-slate-500">No meetings linked.</li>}
            </ul>
          </Card>
          <Card title="Documents">
            <ul className="space-y-2 text-sm">
              {project.documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between">
                  <Link href={`/documents/${doc.id}`} className="link">{doc.title}</Link>
                  <StatusPill status={doc.status} />
                </li>
              ))}
              {project.documents.length === 0 && <li className="text-slate-500">No documents linked.</li>}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
