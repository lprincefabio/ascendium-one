import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { assertCan, scopeWhere } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, EmptyState, PageHeader, Pill, StatCard, Table, StatusPill } from "@/components/ui";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function scoreTone(score: number): "red" | "amber" | "slate" {
  return score >= 12 ? "red" : score >= 6 ? "amber" : "slate";
}

export default async function RisksPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = (await getCurrentUser())!;
  assertCan(user, "risk", "read");
  const { status } = await searchParams;

  const scope = scopeWhere(user, "risk", "read") as Prisma.RiskWhereInput;
  const risks = await prisma.risk.findMany({
    where: {
      organisationId: user.organisationId,
      deletedAt: null,
      ...scope,
      ...(status ? { status } : {}),
    },
    include: {
      owner: { select: { firstName: true, lastName: true } },
      subsidiary: { select: { name: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { probability: "desc" }, { impact: "desc" }],
    take: 200,
  });

  const open = risks.filter((r) => r.status === "open" || r.status === "mitigating");
  const high = open.filter((r) => r.probability * r.impact >= 12);
  const escalated = open.filter((r) => r.escalationLevel === "group" || r.escalationLevel === "board");

  return (
    <div>
      <PageHeader title="Risk Register" subtitle={`${open.length} open risks in your scope · ${high.length} high-scoring · ${escalated.length} escalated beyond subsidiary level`} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Open / mitigating" value={open.length} />
        <StatCard label="High (score ≥ 12)" value={high.length} tone={high.length > 0 ? "red" : "green"} />
        <StatCard label="Escalated" value={escalated.length} tone={escalated.length > 0 ? "amber" : "green"} />
        <StatCard label="Board-level" value={open.filter((r) => r.escalationLevel === "board").length} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/risks" className={`rounded-full px-3 py-1 text-xs font-medium ${!status ? "bg-navy-deep text-gold dark:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300"}`}>All</Link>
        {["open", "mitigating", "accepted", "closed"].map((s) => (
          <Link key={s} href={`/risks?status=${s}`} className={`rounded-full px-3 py-1 text-xs font-medium ${status === s ? "bg-navy-deep text-gold dark:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300"}`}>{s}</Link>
        ))}
      </div>

      <Card>
        {risks.length === 0 ? (
          <EmptyState title="No risks in your scope" />
        ) : (
          <Table head={["Risk", "Category", "Scope", "P × I", "Status", "Escalation", "Owner", "Review"]}>
            {risks.map((r) => {
              const score = r.probability * r.impact;
              return (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="td">
                    <span className="flex items-center gap-2 font-medium text-navy-deep dark:text-white">
                      {r.title}
                      {r.isDemo && <Pill tone="gold">demo</Pill>}
                    </span>
                    {r.project && <Link href={`/projects/${r.project.id}`} className="link block text-xs">{r.project.name}</Link>}
                  </td>
                  <td className="td capitalize text-slate-600 dark:text-slate-300">{r.category}</td>
                  <td className="td text-slate-600 dark:text-slate-300">{r.subsidiary?.name ?? "Group"}</td>
                  <td className="td">
                    <Pill tone={scoreTone(score)}>{r.probability} × {r.impact} = {score}</Pill>
                  </td>
                  <td className="td"><StatusPill status={r.status} /></td>
                  <td className="td capitalize text-slate-600 dark:text-slate-300">{r.escalationLevel}</td>
                  <td className="td text-slate-600 dark:text-slate-300">{r.owner ? `${r.owner.firstName} ${r.owner.lastName}` : "—"}</td>
                  <td className="td text-slate-600 dark:text-slate-300">{formatDate(r.reviewDate)}</td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}
