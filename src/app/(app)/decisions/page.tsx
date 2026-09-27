import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getCurrentUser, permissionLevelFor } from "@/lib/auth";
import { assertCan, scopeWhere } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, EmptyState, PageHeader, Pill, StatusPill, Table, RowLink } from "@/components/ui";
import { formatDate, relativeDue } from "@/lib/format";
import { DecisionCreateForm } from "@/components/forms";

export const dynamic = "force-dynamic";

export default async function DecisionsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = (await getCurrentUser())!;
  assertCan(user, "decision", "read");
  const { status } = await searchParams;

  const scope = scopeWhere(user, "decision", "read") as Prisma.DecisionWhereInput;
  const [decisions, subsidiaries] = await Promise.all([
    prisma.decision.findMany({
      where: {
        organisationId: user.organisationId,
        deletedAt: null,
        ...scope,
        ...(status ? { status } : {}),
      },
      include: {
        owner: { select: { firstName: true, lastName: true } },
        subsidiary: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: [{ status: "asc" }, { deadline: "asc" }, { createdAt: "desc" }],
      take: 150,
    }),
    prisma.subsidiary.findMany({
      where: { organisationId: user.organisationId, status: "active" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const canCreate = permissionLevelFor(user, "decision", "create") !== null;
  const scopedSubsidiaries =
    permissionLevelFor(user, "decision", "create") === "group"
      ? subsidiaries
      : subsidiaries.filter((s) => s.id === user.subsidiaryId);

  return (
    <div>
      <PageHeader
        title="Decision Room"
        subtitle={`${decisions.filter((d) => d.status === "open").length} awaiting decision in your scope`}
        actions={canCreate ? <DecisionCreateForm subsidiaries={scopedSubsidiaries} /> : undefined}
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/decisions" className={`rounded-full px-3 py-1 text-xs font-medium ${!status ? "bg-navy-deep text-gold dark:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300"}`}>All</Link>
        {["open", "decided", "approved", "rejected", "superseded"].map((s) => (
          <Link key={s} href={`/decisions?status=${s}`} className={`rounded-full px-3 py-1 text-xs font-medium ${status === s ? "bg-navy-deep text-gold dark:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300"}`}>{s}</Link>
        ))}
      </div>

      <Card>
        {decisions.length === 0 ? (
          <EmptyState title="No decisions in your scope" hint="Frame one with the Frame a decision button." />
        ) : (
          <Table head={["Decision", "Scope", "Owner", "Status", "Deadline"]}>
            {decisions.map((d) => {
              const due = relativeDue(d.deadline);
              const overdueOpen = d.status === "open" && due.overdue;
              return (
                <RowLink
                  key={d.id}
                  href={`/decisions/${d.id}`}
                  cells={[
                    <span key="t" className="flex items-center gap-2">
                      {d.title}
                      {d.isDemo && <Pill tone="gold">demo</Pill>}
                      {d.aiAssisted && <Pill tone="teal">AI-assisted</Pill>}
                    </span>,
                    <span key="sc" className="text-slate-500 dark:text-slate-400">{d.subsidiary?.name ?? d.project?.name ?? "Group"}</span>,
                    <span key="o" className="text-slate-600 dark:text-slate-300">{d.owner ? `${d.owner.firstName} ${d.owner.lastName}` : "—"}</span>,
                    <StatusPill key="s" status={d.status} />,
                    <span key="d" className={overdueOpen ? "font-medium text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-300"}>
                      {d.deadline ? due.label : "—"}
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
