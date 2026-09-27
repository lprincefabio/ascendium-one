import Link from "next/link";
import { getCurrentUser, permissionLevelFor } from "@/lib/auth";
import { assertCan } from "@/lib/rbac";
import { LEVEL_RANK } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { Card, EmptyState, PageHeader, Pill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SubsidiariesPage() {
  const user = (await getCurrentUser())!;
  assertCan(user, "subsidiary", "read");
  const level = permissionLevelFor(user, "subsidiary", "read")!;

  const subsidiaries = await prisma.subsidiary.findMany({
    where: {
      organisationId: user.organisationId,
      status: "active",
      ...(LEVEL_RANK[level] >= LEVEL_RANK.group ? {} : { id: user.subsidiaryId ?? "" }),
    },
    include: {
      cluster: { select: { name: true } },
      _count: { select: { users: { where: { isActive: true } }, departments: true, projects: true } },
    },
    orderBy: [{ cluster: { sortOrder: "asc" } }, { name: "asc" }],
    take: 100,
  });

  const clusters = [...new Map(subsidiaries.filter((s) => s.cluster).map((s) => [s.cluster!.name, s.cluster!.name])).values()];

  return (
    <div>
      <PageHeader
        title="Subsidiaries"
        subtitle={`${subsidiaries.length} active enterprises${level !== "group" ? " in your scope" : " across the Ascendium Global Holdings ecosystem"}`}
      />

      {subsidiaries.length === 0 ? (
        <Card><EmptyState title="No subsidiaries in your scope" /></Card>
      ) : (
        <div className="space-y-6">
          {clusters.map((clusterName) => (
            <section key={clusterName}>
              <h2 className="font-display mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{clusterName} cluster</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {subsidiaries.filter((s) => s.cluster?.name === clusterName).map((s) => (
                  <Link key={s.id} href={`/subsidiaries/${s.slug}`} className="card block p-4 transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-navy-deep dark:text-white">{s.name}</p>
                      {s.isDemo && <Pill tone="gold">demo</Pill>}
                    </div>
                    {s.sector && <p className="mt-0.5 text-xs capitalize text-slate-500">{s.sector}</p>}
                    {s.description && <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{s.description.replace("[DEMO] ", "")}</p>}
                    <div className="mt-3 flex gap-4 text-xs text-slate-500">
                      <span>{s._count.users} people</span>
                      <span>{s._count.departments} departments</span>
                      <span>{s._count.projects} projects</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
          {subsidiaries.some((s) => !s.cluster) && (
            <section>
              <h2 className="font-display mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ungrouped</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {subsidiaries.filter((s) => !s.cluster).map((s) => (
                  <Link key={s.id} href={`/subsidiaries/${s.slug}`} className="card block p-4 transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-navy-deep dark:text-white">{s.name}</p>
                      {s.isDemo && <Pill tone="gold">demo</Pill>}
                    </div>
                    <div className="mt-3 flex gap-4 text-xs text-slate-500">
                      <span>{s._count.users} people</span>
                      <span>{s._count.departments} departments</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
