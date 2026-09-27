import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { assertCan, scopeWhere } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, EmptyState, PageHeader, Pill, StatCard, Table } from "@/components/ui";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_TONE_OPPORTUNITY: Record<string, "blue" | "amber" | "teal" | "green" | "slate"> = {
  new: "blue",
  evaluating: "amber",
  pursuing: "teal",
  won: "green",
  parked: "slate",
};

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = (await getCurrentUser())!;
  assertCan(user, "opportunity", "read");
  const { status } = await searchParams;

  const scope = scopeWhere(user, "opportunity", "read") as Prisma.OpportunityWhereInput;
  const opportunities = await prisma.opportunity.findMany({
    where: {
      organisationId: user.organisationId,
      ...scope,
      ...(status ? { status } : {}),
    },
    include: {
      owner: { select: { firstName: true, lastName: true } },
      subsidiary: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  const open = opportunities.filter((o) => o.status === "new" || o.status === "evaluating" || o.status === "pursuing");

  return (
    <div>
      <PageHeader title="Opportunities" subtitle={`${open.length} open opportunities in your scope`} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Open" value={open.length} />
        <StatCard label="Pursuing" value={opportunities.filter((o) => o.status === "pursuing").length} tone="green" />
        <StatCard label="Won" value={opportunities.filter((o) => o.status === "won").length} tone="green" />
        <StatCard label="New this quarter" value={opportunities.filter((o) => o.status === "new" && Date.now() - o.createdAt.getTime() < 90 * 24 * 3600 * 1000).length} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/opportunities" className={`rounded-full px-3 py-1 text-xs font-medium ${!status ? "bg-navy-deep text-gold dark:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300"}`}>All</Link>
        {["new", "evaluating", "pursuing", "won", "parked"].map((s) => (
          <Link key={s} href={`/opportunities?status=${s}`} className={`rounded-full px-3 py-1 text-xs font-medium ${status === s ? "bg-navy-deep text-gold dark:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300"}`}>{s}</Link>
        ))}
      </div>

      <Card>
        {opportunities.length === 0 ? (
          <EmptyState title="No opportunities in your scope" />
        ) : (
          <Table head={["Opportunity", "Category", "Status", "Owner", "Subsidiary", "Logged"]}>
            {opportunities.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                <td className="td">
                  <span className="flex items-center gap-2 font-medium text-navy-deep dark:text-white">
                    {o.title}
                    {o.isDemo && <Pill tone="gold">demo</Pill>}
                  </span>
                  {o.description && <span className="block max-w-md truncate text-xs text-slate-500 dark:text-slate-400">{o.description}</span>}
                </td>
                <td className="td capitalize text-slate-600 dark:text-slate-300">{o.category.replace(/_/g, " ")}</td>
                <td className="td"><Pill tone={STATUS_TONE_OPPORTUNITY[o.status] ?? "slate"}>{o.status}</Pill></td>
                <td className="td text-slate-600 dark:text-slate-300">{o.owner ? `${o.owner.firstName} ${o.owner.lastName}` : "—"}</td>
                <td className="td text-slate-600 dark:text-slate-300">{o.subsidiary?.name ?? "Group"}</td>
                <td className="td text-slate-600 dark:text-slate-300">{formatDate(o.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
