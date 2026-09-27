import { getCurrentUser, permissionLevelFor } from "@/lib/auth";
import { assertCan, scopeWhere } from "@/lib/rbac";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Card, EmptyState, PageHeader, Pill, StatusPill } from "@/components/ui";
import { formatCurrency, formatDate, relativeDue } from "@/lib/format";
import { ApprovalDecide } from "@/components/forms";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const user = (await getCurrentUser())!;
  assertCan(user, "approval", "read");
  const orgId = user.organisationId;

  const scope = scopeWhere(user, "approval", "read") as Prisma.ApprovalWhereInput;
  const [awaitingMe, myRequests, decided] = await Promise.all([
    prisma.approval.findMany({
      where: { organisationId: orgId, status: "pending", approverId: user.id },
      include: { requester: { select: { firstName: true, lastName: true } }, subsidiary: { select: { name: true } } },
      orderBy: { deadline: "asc" },
      take: 50,
    }),
    prisma.approval.findMany({
      where: { organisationId: orgId, requesterId: user.id },
      include: { approver: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.approval.findMany({
      where: { organisationId: orgId, status: { in: ["approved", "rejected", "changes_requested"] }, ...scope },
      include: { requester: { select: { firstName: true, lastName: true } }, approver: { select: { firstName: true, lastName: true } } },
      orderBy: { decidedAt: "desc" },
      take: 25,
    }),
  ]);

  const canApprove = permissionLevelFor(user, "approval", "approve") !== null;

  return (
    <div>
      <PageHeader
        title="Approvals"
        subtitle={awaitingMe.length > 0 ? `${awaitingMe.length} request${awaitingMe.length === 1 ? "" : "s"} awaiting your decision` : "Nothing awaits your decision"}
      />

      <div className="space-y-5">
        <Card title={`Awaiting my decision (${awaitingMe.length})`}>
          {awaitingMe.length === 0 ? (
            <EmptyState title="Your decision inbox is clear" />
          ) : (
            <ul className="space-y-3">
              {awaitingMe.map((a) => {
                const due = relativeDue(a.deadline);
                return (
                  <li key={a.id} className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-navy-deep dark:text-white">
                          {a.title}
                          <Pill tone="slate">{a.kind.replace("_", " ")}</Pill>
                          {a.isDemo && <Pill tone="gold">demo</Pill>}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          From {a.requester ? `${a.requester.firstName} ${a.requester.lastName}` : "—"}
                          {a.subsidiary ? ` · ${a.subsidiary.name}` : ""}
                          {a.financialImpactCents != null && <> · financial impact {formatCurrency(a.financialImpactCents)}</>}
                          {a.deadline && <span className={due.overdue ? " font-medium text-red-600 dark:text-red-400" : ""}> · {due.label}</span>}
                        </p>
                      </div>
                      <StatusPill status={a.status} />
                    </div>
                    {a.detail && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{a.detail}</p>}
                    {canApprove && <ApprovalDecide id={a.id} kind={a.kind.replace("_", " ")} />}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card title={`My requests (${myRequests.length})`}>
            {myRequests.length === 0 ? (
              <EmptyState title="You have not submitted any requests" />
            ) : (
              <ul className="space-y-2">
                {myRequests.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-white/5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-navy-deep dark:text-white">{a.title}</span>
                      <span className="text-xs text-slate-500">
                        to {a.approver ? `${a.approver.firstName} ${a.approver.lastName}` : "—"} · {formatDate(a.createdAt)}
                      </span>
                    </span>
                    <StatusPill status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Recently decided in my scope (${decided.length})`}>
            {decided.length === 0 ? (
              <EmptyState title="No decided approvals in your scope" />
            ) : (
              <ul className="space-y-2">
                {decided.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-white/5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-navy-deep dark:text-white">{a.title}</span>
                      <span className="text-xs text-slate-500">
                        {a.requester ? `${a.requester.firstName} ${a.requester.lastName}` : "—"} → {a.approver ? `${a.approver.firstName} ${a.approver.lastName}` : "—"}
                      </span>
                    </span>
                    <StatusPill status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
