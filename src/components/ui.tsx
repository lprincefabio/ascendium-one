import Link from "next/link";
import { initials } from "@/lib/format";

export function Card({ title, action, children, className = "" }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      {title && (
        <header className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-navy-deep dark:text-white">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

const PILL_TONES: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  red: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  blue: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300",
  gold: "bg-gold/20 text-yellow-800 dark:text-yellow-300",
  teal: "bg-teal/15 text-teal dark:text-teal",
};

export function Pill({ tone = "slate", children }: { tone?: keyof typeof PILL_TONES; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PILL_TONES[tone]}`}>{children}</span>;
}

const STATUS_TONE: Record<string, keyof typeof PILL_TONES> = {
  todo: "slate", in_progress: "blue", blocked: "red", review: "amber", done: "green", cancelled: "slate",
  planning: "slate", active: "green", on_hold: "amber", completed: "green",
  open: "blue", decided: "green", approved: "green", rejected: "red", superseded: "slate",
  mitigating: "amber", accepted: "gold", closed: "slate",
  on_track: "green", at_risk: "amber", off_track: "red", achieved: "green", paused: "slate",
  low: "slate", medium: "blue", high: "amber", critical: "red",
  new: "blue", evaluating: "amber", pursuing: "teal",
  reported: "slate", assigned: "blue", investigating: "amber", escalated: "red", resolved: "green",
  contained: "green", monitoring: "amber",
};

export function StatusPill({ status }: { status: string }) {
  const label = status.replace(/_/g, " ");
  return <Pill tone={STATUS_TONE[status] ?? "slate"}>{label}</Pill>;
}

export function HealthDot({ health }: { health: string }) {
  const tone = health === "green" ? "bg-emerald-500" : health === "amber" ? "bg-amber-500" : "bg-red-500";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize text-slate-600 dark:text-slate-300">
      <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
      {health}
    </span>
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-yellow-800 dark:text-yellow-300" title="Demonstration data — not real organisational records">
      Demo data
    </span>
  );
}

export function StatCard({ label, value, hint, tone = "slate" }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "slate" | "red" | "amber" | "green" }) {
  const tones = { slate: "text-navy-deep dark:text-white", red: "text-red-600 dark:text-red-400", amber: "text-amber-600 dark:text-amber-400", green: "text-emerald-600 dark:text-emerald-400" };
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`font-display mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export function Avatar({ first, last, hue, size = 8 }: { first: string; last: string; hue: number; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ width: size * 4, height: size * 4, backgroundColor: `hsl(${hue} 45% 38%)` }}
      aria-hidden
    >
      {initials(first, last)}
    </span>
  );
}

export function ProgressBar({ value, tone }: { value: number; tone?: "green" | "amber" | "red" }) {
  const color = tone === "red" ? "bg-red-500" : tone === "amber" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center dark:border-white/15">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold text-navy-deep dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Table({ head, children }: { head: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-slate-200 dark:border-white/10">
            {head.map((h, i) => (
              <th key={i} className="th">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">{children}</tbody>
      </table>
    </div>
  );
}

export function RowLink({ href, cells }: { href: string; cells: React.ReactNode[] }) {
  return (
    <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-white/5">
      {cells.map((c, i) => (
        <td key={i} className="td">
          {i === 0 ? <Link href={href} className="font-medium text-navy-deep hover:text-teal dark:text-white">{c}</Link> : c}
        </td>
      ))}
    </tr>
  );
}
