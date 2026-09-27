import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, permissionLevelFor } from "@/lib/auth";
import { assertCan } from "@/lib/rbac";
import { LEVEL_RANK } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { Card, DemoBadge, EmptyState, HealthDot, PageHeader, Pill, StatCard, StatusPill, Table, RowLink } from "@/components/ui";
import { formatCompactMoney, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SubsidiaryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = (await getCurrentUser())!;
  assertCan(user, "subsidiary", "read");
  const { slug } = await params;

  const sub = await prisma.subsidiary.findFirst({
    where: { slug, organisationId: user.organisationId, status: "active" },
    include: {
      cluster: { select: { name: true } },
      departments: {
        include: { head: { select: { firstName: true, lastName: true } }, users: { where: { isActive: true }, select: { id: true } } },
        orderBy: { name: "asc" },
      },
      kpis: { include: { values: { orderBy: { period: "desc" }, take: 1 } }, orderBy: { name: "asc" }, take: 12 },
      projects: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 10 },
      risks: { where: { status: { in: ["open", "mitigating"] } }, take: 6 },
    },
  });
  if (!sub) notFound();

  const level = permissionLevelFor(user, "subsidiary", "read")!;
  if (LEVEL_RANK[level] < LEVEL_RANK.group && sub.id !== user.subsidiaryId) notFound();

  const headcount = await prisma.user.count({ where: { organisationId: user.organisationId, subsidiaryId: sub.id, isActive: true } });
  const revenueKpi = sub.kpis.find((k) => /revenue/i.test(k.name));

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {sub.name}
            {sub.isDemo && <DemoBadge />}
          </span>
        }
        subtitle={
          <span>
            {sub.cluster?.name ?? "Ungrouped"} cluster{sub.sector ? ` · ${sub.sector}` : ""}
            {sub.website && <> · <a href={sub.website} target="_blank" rel="noreferrer" className="link">{sub.website.replace(/^https?:\/\//, "")}</a></>}
          </span>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="People" value={headcount} />
        <StatCard label="Departments" value={sub.departments.length} />
        <StatCard label="Active projects" value={sub.projects.filter((p) => p.status === "active").length} />
        <StatCard label="Reported revenue" value={revenueKpi?.values[0] ? `${revenueKpi.values[0].value.toLocaleString("en-US")} ${revenueKpi.unit}` : "—"} />
      </div>

      {sub.description && (
        <Card title="About">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{sub.description}</p>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Departments">
          {sub.departments.length === 0 ? (
            <EmptyState title="No departments" />
          ) : (
            <Table head={["Department", "Head", "Members"]}>
              {sub.departments.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="td font-medium text-navy-deep dark:text-white">{d.name}</td>
                  <td className="td text-slate-600 dark:text-slate-300">{d.head ? `${d.head.firstName} ${d.head.lastName}` : "—"}</td>
                  <td className="td text-slate-600 dark:text-slate-300">{d.users.length}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="KPIs">
          {sub.kpis.length === 0 ? (
            <EmptyState title="No KPIs reported" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {sub.kpis.map((k) => (
                <li key={k.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-navy-deep dark:text-white">{k.name.replace("[DEMO] ", "")}</span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {k.values[0]?.value.toLocaleString("en-US") ?? "—"} {k.unit}
                    {k.values[0]?.target != null && <span className="ml-2 text-xs text-slate-400">target {k.values[0].target.toLocaleString("en-US")}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Projects" action={<Link href="/projects" className="link text-xs">All projects</Link>}>
          {sub.projects.length === 0 ? (
            <EmptyState title="No projects" />
          ) : (
            <Table head={["Project", "Status", "Health", "Budget", "Due"]}>
              {sub.projects.map((p) => (
                <RowLink
                  key={p.id}
                  href={`/projects/${p.id}`}
                  cells={[
                    p.name,
                    <StatusPill key="s" status={p.status} />,
                    <HealthDot key="h" health={p.health} />,
                    <span key="b" className="text-slate-600 dark:text-slate-300">{formatCompactMoney(p.budgetCents)}</span>,
                    <span key="d" className="text-slate-600 dark:text-slate-300">{formatDate(p.dueDate)}</span>,
                  ]}
                />
              ))}
            </Table>
          )}
        </Card>

        <Card title="Open risks">
          {sub.risks.length === 0 ? (
            <EmptyState title="No open risks" />
          ) : (
            <ul className="space-y-2">
              {sub.risks.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-white/5">
                  <span className="min-w-0 flex-1 truncate font-medium text-navy-deep dark:text-white">{r.title}</span>
                  <Pill tone={r.probability * r.impact >= 12 ? "red" : r.probability * r.impact >= 6 ? "amber" : "slate"}>score {r.probability * r.impact}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
