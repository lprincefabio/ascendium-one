import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { assertCan, scopeWhere } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, EmptyState, PageHeader, Pill, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function KpisPage() {
  const user = (await getCurrentUser())!;
  assertCan(user, "kpi", "read");

  const scope = scopeWhere(user, "kpi", "read") as Prisma.KpiWhereInput;
  const kpis = await prisma.kpi.findMany({
    where: { organisationId: user.organisationId, deletedAt: null, ...scope },
    include: {
      owner: { select: { firstName: true, lastName: true } },
      subsidiary: { select: { name: true } },
      values: { orderBy: { period: "desc" }, take: 6 },
    },
    orderBy: [{ standard: "desc" }, { name: "asc" }],
    take: 120,
  });

  const withLatest = kpis.map((k) => ({ k, latest: k.values[0] ?? null }));
  const onTrack = withLatest.filter(({ k, latest }) => {
    if (!latest || latest.target == null) return true;
    return k.direction === "down" ? latest.value <= latest.target : latest.value >= latest.target;
  }).length;
  const demoCount = kpis.filter((k) => k.isDemo).length;

  return (
    <div>
      <PageHeader
        title="KPIs"
        subtitle={`${kpis.length} indicators in your scope${demoCount > 0 ? ` · ${demoCount} labelled demo` : ""}`}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Indicators" value={kpis.length} />
        <StatCard label="On track" value={onTrack} tone={onTrack === kpis.length ? "green" : "amber"} />
        <StatCard label="Attention" value={kpis.length - onTrack} tone={kpis.length - onTrack > 0 ? "red" : "green"} />
        <StatCard label="Group standard" value={kpis.filter((k) => k.standard).length} />
      </div>

      {kpis.length === 0 ? (
        <Card><EmptyState title="No KPIs in your scope" /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kpis.map((k) => {
            const latest = k.values[0] ?? null;
            const offTrack = latest && latest.target != null && (k.direction === "down" ? latest.value > latest.target : latest.value < latest.target);
            return (
              <Card key={k.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy-deep dark:text-white">{k.name.replace("[DEMO] ", "")}</p>
                    <p className="mt-0.5 text-xs capitalize text-slate-500">{k.category}{k.standard ? " · group standard" : ""}{k.subsidiary ? ` · ${k.subsidiary.name}` : ""}</p>
                  </div>
                  <span className="flex shrink-0 gap-1.5">
                    {k.isDemo && <Pill tone="gold">demo</Pill>}
                    {offTrack ? <Pill tone="red">off track</Pill> : <Pill tone="green">on track</Pill>}
                  </span>
                </div>
                <p className="font-display mt-3 text-3xl font-semibold text-navy-deep dark:text-white">
                  {latest ? latest.value.toLocaleString("en-US") : "—"}
                  <span className="ml-1 text-sm font-normal text-slate-500">{k.unit}</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {latest?.period ? `Period ${latest.period}` : "No measurements yet"}
                  {latest?.target != null && ` · target ${latest.target.toLocaleString("en-US")}`}
                </p>
                {k.values.length > 1 && (
                  <div className="mt-3 flex h-10 items-end gap-1">
                    {[...k.values].reverse().map((m) => {
                      const max = Math.max(...k.values.map((v) => Math.abs(v.value)), 1);
                      const h = Math.max(8, Math.round((Math.abs(m.value) / max) * 40));
                      const hit = m.target != null && (k.direction === "down" ? m.value <= m.target : m.value >= m.target);
                      return (
                        <span
                          key={m.id}
                          title={`${m.period}: ${m.value}${m.target != null ? ` (target ${m.target})` : ""}`}
                          className={`flex-1 rounded-t ${hit ? "bg-emerald-500/80" : "bg-navy/50 dark:bg-white/20"}`}
                          style={{ height: h }}
                        />
                      );
                    })}
                  </div>
                )}
                {k.owner && <p className="mt-3 text-xs text-slate-500">Owner: {k.owner.firstName} {k.owner.lastName}</p>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
