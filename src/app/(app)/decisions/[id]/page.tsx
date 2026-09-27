import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { assertCan } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, DemoBadge, EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { formatDate, formatDateTime, relativeDue } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DecisionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = (await getCurrentUser())!;
  assertCan(user, "decision", "read");
  const { id } = await params;

  const decision = await prisma.decision.findFirst({
    where: { id, organisationId: user.organisationId, deletedAt: null },
    include: {
      owner: { select: { firstName: true, lastName: true } },
      subsidiary: { select: { name: true } },
      department: { select: { name: true } },
      project: { select: { name: true } },
    },
  });
  if (!decision) notFound();

  const options = (() => {
    try {
      const parsed = JSON.parse(decision.options);
      return Array.isArray(parsed) ? parsed.filter((o: unknown) => typeof o === "string") as string[] : [];
    } catch {
      return decision.options ? [decision.options] : [];
    }
  })();

  const due = relativeDue(decision.deadline);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {decision.title}
            {decision.isDemo && <DemoBadge />}
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2">
            <StatusPill status={decision.status} />
            {decision.subsidiary && <span>· {decision.subsidiary.name}</span>}
            {decision.department && <span>· {decision.department.name}</span>}
            {decision.project && <span>· {decision.project.name}</span>}
            <span>· owner {decision.owner ? `${decision.owner.firstName} ${decision.owner.lastName}` : "—"}</span>
          </span>
        }
      />

      {decision.deadline && (
        <div className={`mb-4 rounded-lg p-3 text-sm font-medium ${due.overdue && decision.status === "open" ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "bg-slate-50 text-slate-600 dark:bg-white/5 dark:text-slate-300"}`}>
          Decision needed: {formatDate(decision.deadline)} — {due.label}
        </div>
      )}

      <div className="space-y-4">
        {[
          ["Context", decision.context],
          ["Problem statement", decision.problem],
        ].map(([label, value]) => value ? (
          <Card key={label as string} title={label as string}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{value}</p>
          </Card>
        ) : null)}

        {options.length > 0 && (
          <Card title="Options considered">
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-700 dark:text-slate-300">
              {options.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          </Card>
        )}

        {[
          ["Evidence", decision.evidence],
          ["Recommendation", decision.recommendation],
          ["Financial implication", decision.financialImplication],
          ["Risk assessment", decision.riskAssessment],
          ["Strategic alignment", decision.strategicAlignment],
          ["Dependencies", decision.dependencies],
          ["Decision authority", decision.authority],
        ].map(([label, value]) => value ? (
          <Card key={label as string} title={label as string}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{value}</p>
          </Card>
        ) : null)}

        <Card title="Record">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Framed</dt><dd className="text-navy-deep dark:text-white">{formatDateTime(decision.createdAt)}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Decided</dt><dd className="text-navy-deep dark:text-white">{decision.decidedAt ? formatDateTime(decision.decidedAt) : "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">AI-assisted framing</dt><dd className="text-navy-deep dark:text-white">{decision.aiAssisted ? "Yes" : "No"}</dd></div>
            {decision.rationale && (
              <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-slate-500">Rationale</dt><dd className="whitespace-pre-wrap text-navy-deep dark:text-white">{decision.rationale}</dd></div>
            )}
          </dl>
        </Card>
      </div>
    </div>
  );
}
