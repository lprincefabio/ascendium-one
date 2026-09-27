import Link from "next/link";
import { Card, DemoBadge, HealthDot, PageHeader, Pill, StatCard, Table, StatusPill, RowLink } from "@/components/ui";
import type { MorningBrief } from "@/lib/services/pulse";

type SubData = {
  name: string;
  tagline: string | null;
  clusterName: string;
  sector: string | null;
  ceoName: string | null;
  isDemo: boolean;
  revenueLabel: string;
  headcount: number | null;
  kpis: { id: string; name: string; unit: string; latest: number | null; target: number | null }[];
  projects: { id: string; name: string; code: string; health: string; status: string; budgetCents: bigint; spentCents: bigint }[];
  risks: { id: string; title: string; probability: number; impact: number; status: string }[];
  departments: { id: string; name: string; headName: string | null; memberCount: number }[];
  brief: MorningBrief;
};

export default function SubsidiaryDashboard({ sub }: { sub: SubData }) {
  const red = sub.projects.filter((p) => p.health === "red").length;
  const openRisks = sub.risks.filter((r) => r.status === "open" || r.status === "mitigating").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title={<span className="flex items-center gap-3">{sub.name} {sub.isDemo && <DemoBadge />}</span>}
        subtitle={`${sub.clusterName} cluster · ${sub.sector ?? ""} · Led by ${sub.ceoName ?? "—"}`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Revenue (reported)" value={sub.revenueLabel} />
        <StatCard label="People" value={sub.headcount ?? "—"} />
        <StatCard label="Active projects" value={sub.projects.length} hint={red > 0 ? `${red} in red health` : "All green/amber"} tone={red > 0 ? "amber" : "slate"} />
        <StatCard label="Open risks" value={openRisks} tone={openRisks > 2 ? "amber" : "slate"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Subsidiary KPIs" action={<Link href="/kpis" className="link text-xs">All KPIs</Link>}>
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {sub.kpis.map((k) => (
              <li key={k.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-navy-deep dark:text-white">{k.name.replace("[DEMO] ", "")}</span>
                <span className="text-slate-600 dark:text-slate-300">
                  {k.latest ?? "—"} {k.unit}
                  {k.target != null && <span className="ml-2 text-xs text-slate-400">target {k.target}</span>}
                </span>
              </li>
            ))}
            {sub.kpis.length === 0 && <li className="py-3 text-sm text-slate-500">No KPIs configured yet.</li>}
          </ul>
        </Card>

        <Card title="Morning Brief" action={<Pill tone="gold">AI-generated</Pill>}>
          <p className="font-display text-lg text-navy-deep dark:text-white">{sub.brief.greeting}</p>
          <ul className="mt-3 space-y-2">
            {sub.brief.items.slice(0, 6).map((i) => (
              <li key={i.label} className="flex items-center gap-3 text-sm">
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-navy-deep px-1.5 text-xs font-bold text-gold dark:bg-white/10">{i.count}</span>
                <Link href={i.href} className="min-w-0 flex-1 hover:opacity-80">
                  <span className="block font-medium text-navy-deep dark:text-white">{i.label}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{i.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Projects" action={<Link href="/projects" className="link text-xs">All projects</Link>}>
          <Table head={["Project", "Status", "Health", "Budget spent"]}>
            {sub.projects.map((p) => (
              <RowLink
                key={p.id}
                href={`/projects/${p.id}`}
                cells={[
                  <span key="n">{p.name} <span className="block text-xs text-slate-400">{p.code}</span></span>,
                  <StatusPill key="s" status={p.status} />,
                  <HealthDot key="h" health={p.health} />,
                  <span key="b" className="text-slate-600 dark:text-slate-300">
                    {p.budgetCents > 0 ? `${Math.round(Number((p.spentCents * 100n) / p.budgetCents))}%` : "—"}
                  </span>,
                ]}
              />
            ))}
            {sub.projects.length === 0 && (
              <tr><td className="td text-slate-500" colSpan={4}>No projects in this subsidiary yet.</td></tr>
            )}
          </Table>
        </Card>

        <Card title="Departments" action={<Link href="/directory" className="link text-xs">Directory</Link>}>
          <Table head={["Department", "Head", "Members"]}>
            {sub.departments.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                <td className="td font-medium text-navy-deep dark:text-white">{d.name}</td>
                <td className="td text-slate-600 dark:text-slate-300">{d.headName ?? "—"}</td>
                <td className="td text-slate-600 dark:text-slate-300">{d.memberCount}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </div>
  );
}
