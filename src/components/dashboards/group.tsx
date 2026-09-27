import Link from "next/link";
import { Card, DemoBadge, Pill, StatCard } from "@/components/ui";
import type { MorningBrief, PulseDimension } from "@/lib/services/pulse";

const PULSE_TONE: Record<PulseDimension["status"], { dot: string; pill: "green" | "teal" | "amber" | "red"; label: string }> = {
  strong: { dot: "bg-emerald-500", pill: "green", label: "Strong" },
  stable: { dot: "bg-teal", pill: "teal", label: "Stable" },
  attention: { dot: "bg-amber-500", pill: "amber", label: "Needs attention" },
  concern: { dot: "bg-red-500", pill: "red", label: "Concern" },
};

export type KpiStripItem = { id: string; name: string; unit: string; latest: number | null; target: number | null; isDemo: boolean };

export default function GroupDashboard({
  pulse,
  brief,
  kpiStrip,
  subsidiaryCount,
  peopleCount,
  openProjects,
  pendingApprovals,
  executiveName,
}: {
  pulse: PulseDimension[];
  brief: MorningBrief;
  kpiStrip: KpiStripItem[];
  subsidiaryCount: number;
  peopleCount: number;
  openProjects: number;
  pendingApprovals: number;
  executiveName: string;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy-deep dark:text-white">
            Group Command Centre — Ascendium Global Holdings
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Institutional view across {subsidiaryCount} enterprises · signed in as {executiveName}
          </p>
        </div>
        <DemoBadge />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Enterprises" value={subsidiaryCount} hint="Across five clusters" />
        <StatCard label="People on platform" value={peopleCount} hint="Active identities" />
        <StatCard label="Open projects" value={openProjects} hint="Group-wide" />
        <StatCard label="Approvals pending" value={pendingApprovals} hint="Awaiting executive decision" tone={pendingApprovals > 4 ? "amber" : "slate"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Group Pulse */}
        <Card title="Ascendium Pulse" className="lg:col-span-3"
          action={<Link href="/org-map" className="link text-xs">Open Ascendium Map</Link>}>
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {pulse.map((p) => {
              const t = PULSE_TONE[p.status];
              return (
                <li key={p.key} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-navy-deep dark:text-white">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${t.dot}`} />
                      {p.label}
                    </p>
                    <p className="mt-0.5 pl-5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{p.evidence}</p>
                  </div>
                  <Link href={p.drillHref} className="shrink-0"><Pill tone={t.pill}>{t.label}</Pill></Link>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Morning Brief */}
        <Card className="lg:col-span-2"
          title={
            <span>
              Ascendium Morning Brief
            </span>
          }
          action={<Pill tone="gold">AI-generated</Pill>}>
          <p className="font-display text-lg text-navy-deep dark:text-white">{brief.greeting}</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Here is what requires your attention today.</p>
          {brief.headline && (
            <div className="mt-3 rounded-lg border border-gold/30 bg-gold/10 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-yellow-800 dark:text-yellow-300">{brief.headline.title}</p>
              <p className="mt-0.5 text-sm font-medium text-navy-deep dark:text-white">{brief.headline.body}</p>
            </div>
          )}
          <ul className="mt-3 space-y-2">
            {brief.items.map((i) => (
              <li key={i.label} className="flex items-center gap-3 text-sm">
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-navy-deep px-1.5 text-xs font-bold text-gold dark:bg-white/10">
                  {i.count}
                </span>
                <Link href={i.href} className="min-w-0 flex-1 hover:opacity-80">
                  <span className="block font-medium text-navy-deep dark:text-white">{i.label}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{i.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-500 dark:border-white/10 dark:text-slate-400">
            Generated by Ascendium Intelligence from live system data. Counts are facts; prioritisation is a
            recommendation — verify the underlying records before acting.
          </p>
        </Card>
      </div>

      <Card title="Group KPI snapshot" action={<Link href="/kpis" className="link text-xs">Open KPI engine</Link>}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {kpiStrip.map((k) => {
            const onTrack = k.latest !== null && k.target !== null && k.latest >= k.target;
            return (
              <div key={k.id} className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-navy-deep dark:text-white">{k.name.replace("[DEMO] ", "")}</p>
                  {k.isDemo && <DemoBadge />}
                </div>
                <p className="mt-1 text-xl font-semibold text-navy-deep dark:text-white">
                  {k.latest ?? "—"} <span className="text-xs font-normal text-slate-500">{k.unit}</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Target {k.target ?? "—"} · {onTrack ? "on track" : "below target"}
                </p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
