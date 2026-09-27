import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { assertCan } from "@/lib/rbac";
import { LEVEL_RANK } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { Card, EmptyState, PageHeader, Pill, StatCard, Table, StatusPill } from "@/components/ui";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const SEVERITY_TONE: Record<string, "slate" | "blue" | "amber" | "red"> = {
  low: "slate",
  medium: "blue",
  high: "amber",
  critical: "red",
};

export default async function IssuesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = (await getCurrentUser())!;
  const level = assertCan(user, "issue", "read");
  const { status } = await searchParams;

  // Issue carries subsidiaryId + ownerId only (no departmentId), so scope
  // manually: group sees all, subsidiary sees theirs, department sees own +
  // subsidiary register.
  const scope =
    LEVEL_RANK[level] >= LEVEL_RANK.group
      ? {}
      : LEVEL_RANK[level] >= LEVEL_RANK.subsidiary
        ? { subsidiaryId: user.subsidiaryId ?? "" }
        : { OR: [{ ownerId: user.id }, { subsidiaryId: user.subsidiaryId ?? "" }] };

  const issues = await prisma.issue.findMany({
    where: {
      organisationId: user.organisationId,
      ...scope,
      ...(status ? { status } : {}),
    },
    include: {
      owner: { select: { firstName: true, lastName: true } },
      subsidiary: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { severity: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const open = issues.filter((i) => i.status !== "resolved");

  return (
    <div>
      <PageHeader title="Issues" subtitle={`${open.length} open issues in your scope`} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Open" value={open.length} tone={open.length > 0 ? "amber" : "green"} />
        <StatCard label="Critical / high" value={open.filter((i) => i.severity === "critical" || i.severity === "high").length} tone={open.some((i) => i.severity === "critical") ? "red" : "green"} />
        <StatCard label="Escalated" value={open.filter((i) => i.status === "escalated").length} tone={open.some((i) => i.status === "escalated") ? "red" : "green"} />
        <StatCard label="Resolved" value={issues.filter((i) => i.status === "resolved").length} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/issues" className={`rounded-full px-3 py-1 text-xs font-medium ${!status ? "bg-navy-deep text-gold dark:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300"}`}>All</Link>
        {["reported", "assigned", "investigating", "escalated", "resolved"].map((s) => (
          <Link key={s} href={`/issues?status=${s}`} className={`rounded-full px-3 py-1 text-xs font-medium ${status === s ? "bg-navy-deep text-gold dark:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300"}`}>{s}</Link>
        ))}
      </div>

      <Card>
        {issues.length === 0 ? (
          <EmptyState title="No issues in your scope" />
        ) : (
          <Table head={["Issue", "Severity", "Status", "Owner", "Subsidiary", "Reported"]}>
            {issues.map((i) => (
              <tr key={i.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                <td className="td">
                  <span className="flex items-center gap-2 font-medium text-navy-deep dark:text-white">
                    {i.title}
                    {i.isDemo && <Pill tone="gold">demo</Pill>}
                  </span>
                  {i.description && <span className="block max-w-md truncate text-xs text-slate-500 dark:text-slate-400">{i.description}</span>}
                </td>
                <td className="td"><Pill tone={SEVERITY_TONE[i.severity] ?? "slate"}>{i.severity}</Pill></td>
                <td className="td"><StatusPill status={i.status} /></td>
                <td className="td text-slate-600 dark:text-slate-300">{i.owner ? `${i.owner.firstName} ${i.owner.lastName}` : "—"}</td>
                <td className="td text-slate-600 dark:text-slate-300">{i.subsidiary?.name ?? "Group"}</td>
                <td className="td text-slate-600 dark:text-slate-300">{formatDate(i.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
