import { getCurrentUser } from "@/lib/auth";
import { assertCan } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, EmptyState, PageHeader, Pill, ProgressBar, StatusPill } from "@/components/ui";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const LEVELS = ["group", "cluster", "subsidiary", "department", "individual"] as const;

export default async function StrategyPage() {
  const user = (await getCurrentUser())!;
  assertCan(user, "strategy", "read");

  const objectives = await prisma.objective.findMany({
    where: { organisationId: user.organisationId, deletedAt: null },
    include: {
      owner: { select: { firstName: true, lastName: true } },
      subsidiary: { select: { name: true } },
      department: { select: { name: true } },
      keyResults: true,
      children: { select: { id: true }, where: { deletedAt: null } },
      parent: { select: { title: true } },
      kpis: { select: { id: true, name: true }, take: 3 },
    },
    orderBy: [{ level: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const byLevel = LEVELS.map((level) => ({ level, items: objectives.filter((o) => o.level === level) }));

  return (
    <div>
      <PageHeader
        title="Strategy"
        subtitle="Group objectives cascade from group level through clusters, subsidiaries and departments to individuals."
      />

      {objectives.length === 0 && (
        <Card><EmptyState title="No objectives defined yet" /></Card>
      )}

      <div className="space-y-6">
        {byLevel.filter((g) => g.items.length > 0).map((g) => (
          <section key={g.level}>
            <h2 className="font-display mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {g.level} objectives <span className="ml-1 text-navy dark:text-slate-300">({g.items.length})</span>
            </h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {g.items.map((o) => (
                <Card key={o.id}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 font-medium text-navy-deep dark:text-white">{o.title.replace("[DEMO] ", "")}</p>
                    <span className="flex shrink-0 gap-1.5">
                      {o.isDemo && <Pill tone="gold">demo</Pill>}
                      <StatusPill status={o.status} />
                    </span>
                  </div>
                  {o.parent && <p className="mt-1 text-xs text-slate-500">Supports: {o.parent.title.replace("[DEMO] ", "")}</p>}
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1"><ProgressBar value={o.progressPct} tone={o.status === "off_track" ? "red" : o.status === "at_risk" ? "amber" : "green"} /></div>
                    <span className="text-sm font-semibold text-navy-deep dark:text-white">{o.progressPct}%</span>
                  </div>
                  <p className="mt-2 text-xs capitalize text-slate-500">
                    {o.horizon} horizon
                    {o.subsidiary ? ` · ${o.subsidiary.name}` : ""}
                    {o.department ? ` · ${o.department.name}` : ""}
                    {o.owner ? ` · ${o.owner.firstName} ${o.owner.lastName}` : ""}
                  </p>
                  {o.keyResults.length > 0 && (
                    <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 dark:border-white/5">
                      {o.keyResults.map((kr) => (
                        <li key={kr.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 dark:text-slate-300">{kr.title}</span>
                          <span className="font-medium text-navy-deep dark:text-white">{kr.currentValue}/{kr.targetValue}{kr.unit}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-xs text-slate-500">
                    {o.children.length} cascaded objective{o.children.length === 1 ? "" : "s"}
                    {o.kpis.length > 0 && ` · linked: ${o.kpis.map((k) => k.name.replace("[DEMO] ", "")).join(", ")}`}
                    {o.dueDate && ` · due ${formatDate(o.dueDate)}`}
                  </p>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
