import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { assertCan, scopeWhere } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, EmptyState, HealthDot, PageHeader, Pill, ProgressBar, StatusPill, Table, RowLink } from "@/components/ui";
import { formatDate, formatCompactMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = (await getCurrentUser())!;
  assertCan(user, "project", "read");

  const scope = scopeWhere(user, "project", "read") as Prisma.ProjectWhereInput;
  const projects = await prisma.project.findMany({
    where: { organisationId: user.organisationId, deletedAt: null, ...scope },
    include: {
      subsidiary: { select: { name: true } },
      _count: { select: { tasks: { where: { status: { notIn: ["done", "cancelled"] }, deletedAt: null } } } },
    },
    orderBy: [{ health: "desc" }, { updatedAt: "desc" }],
    take: 200,
  });

  const red = projects.filter((p) => p.health === "red").length;

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} in your scope${red > 0 ? ` · ${red} flagged red` : ""}`}
      />

      <Card>
        {projects.length === 0 ? (
          <EmptyState title="No projects in your scope" />
        ) : (
          <Table head={["Project", "Subsidiary", "Status", "Health", "Progress", "Budget", "Open tasks", "Due"]}>
            {projects.map((p) => (
              <RowLink
                key={p.id}
                href={`/projects/${p.id}`}
                cells={[
                  <span key="n" className="flex items-center gap-2">
                    {p.name}
                    {p.isDemo && <Pill tone="gold">demo</Pill>}
                    {p.isCrossSubsidiary && <Pill tone="teal">cross-subsidiary</Pill>}
                  </span>,
                  <span key="s" className="text-slate-500 dark:text-slate-400">{p.subsidiary?.name ?? "Group"}</span>,
                  <StatusPill key="st" status={p.status} />,
                  <HealthDot key="h" health={p.health} />,
                  <span key="pr" className="block w-28"><ProgressBar value={p.progressPct} tone={p.health === "red" ? "red" : p.health === "amber" ? "amber" : "green"} /><span className="mt-0.5 block text-xs text-slate-500">{p.progressPct}%</span></span>,
                  <span key="b" className="text-slate-600 dark:text-slate-300">{formatCompactMoney(p.budgetCents)}</span>,
                  <span key="t" className="text-slate-600 dark:text-slate-300">{p._count.tasks}</span>,
                  <span key="d" className="text-slate-600 dark:text-slate-300">{formatDate(p.dueDate)}</span>,
                ]}
              />
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
