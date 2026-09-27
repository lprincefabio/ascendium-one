import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { assertCan, scopeWhere } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, EmptyState, PageHeader, Pill, StatCard, Table } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const SEVERITY_TONE: Record<string, "slate" | "blue" | "amber" | "red"> = {
  low: "slate",
  medium: "blue",
  high: "amber",
  critical: "red",
};

const STATUS_TONE_INCIDENT: Record<string, "red" | "amber" | "green" | "slate"> = {
  active: "red",
  contained: "amber",
  resolved: "green",
  closed: "slate",
};

function parseTeam(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = (await getCurrentUser())!;
  assertCan(user, "incident", "read");
  const { status } = await searchParams;

  const scope = scopeWhere(user, "incident", "read", []) as Prisma.IncidentWhereInput;
  const incidents = await prisma.incident.findMany({
    where: {
      organisationId: user.organisationId,
      ...scope,
      ...(status ? { status } : {}),
    },
    include: { subsidiary: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { severity: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const live = incidents.filter((i) => i.status === "active" || i.status === "contained");
  const critical = live.filter((i) => i.severity === "critical");

  return (
    <div>
      <PageHeader title="Continuity" subtitle={`${live.length} live incidents in your scope · ${critical.length} critical`} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active" value={incidents.filter((i) => i.status === "active").length} tone={incidents.some((i) => i.status === "active") ? "red" : "green"} />
        <StatCard label="Contained" value={incidents.filter((i) => i.status === "contained").length} tone={incidents.some((i) => i.status === "contained") ? "amber" : "green"} />
        <StatCard label="Critical (live)" value={critical.length} tone={critical.length > 0 ? "red" : "green"} />
        <StatCard label="Resolved / closed" value={incidents.filter((i) => i.status === "resolved" || i.status === "closed").length} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/incidents" className={`rounded-full px-3 py-1 text-xs font-medium ${!status ? "bg-navy-deep text-gold dark:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300"}`}>All</Link>
        {["active", "contained", "resolved", "closed"].map((s) => (
          <Link key={s} href={`/incidents?status=${s}`} className={`rounded-full px-3 py-1 text-xs font-medium ${status === s ? "bg-navy-deep text-gold dark:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300"}`}>{s}</Link>
        ))}
      </div>

      <Card>
        {incidents.length === 0 ? (
          <EmptyState title="No incidents in your scope" />
        ) : (
          <Table head={["Incident", "Kind", "Severity", "Status", "Response team", "Subsidiary", "Opened"]}>
            {incidents.map((i) => {
              const team = parseTeam(i.responseTeam);
              return (
                <tr key={i.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="td">
                    <span className="flex items-center gap-2 font-medium text-navy-deep dark:text-white">
                      {i.title}
                      {i.isDemo && <Pill tone="gold">demo</Pill>}
                    </span>
                    {i.description && <span className="block max-w-md truncate text-xs text-slate-500 dark:text-slate-400">{i.description}</span>}
                  </td>
                  <td className="td capitalize text-slate-600 dark:text-slate-300">{i.kind}</td>
                  <td className="td"><Pill tone={SEVERITY_TONE[i.severity] ?? "slate"}>{i.severity}</Pill></td>
                  <td className="td"><Pill tone={STATUS_TONE_INCIDENT[i.status] ?? "slate"}>{i.status}</Pill></td>
                  <td className="td text-slate-600 dark:text-slate-300">
                    {team.length === 0 ? "—" : team.slice(0, 3).join(", ") + (team.length > 3 ? ` +${team.length - 3}` : "")}
                  </td>
                  <td className="td text-slate-600 dark:text-slate-300">{i.subsidiary?.name ?? "Group"}</td>
                  <td className="td text-slate-600 dark:text-slate-300">{formatDateTime(i.createdAt)}</td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}
