import Link from "next/link";
import { Card, PageHeader, Pill, ProgressBar, StatusPill, Table, RowLink } from "@/components/ui";
import { relativeDue } from "@/lib/format";
import type { MorningBrief } from "@/lib/services/pulse";

type DeptData = {
  name: string;
  mission: string | null;
  headName: string | null;
  subsidiaryName: string | null;
  members: { id: string; firstName: string; lastName: string; title: string | null }[];
  objectives: { id: string; title: string; status: string; progressPct: number }[];
  tasks: { id: string; title: string; status: string; priority: string; dueDate: Date | null; ownerName: string }[];
  projects: { id: string; name: string; health: string; status: string }[];
  kpis: { id: string; name: string; unit: string; latest: number | null; target: number | null }[];
  brief: MorningBrief;
};

const OBJECTIVE_TONE: Record<string, "green" | "amber" | "red" | "slate"> = { on_track: "green", at_risk: "amber", off_track: "red", achieved: "green", paused: "slate" };

export default function DepartmentDashboard({ dept }: { dept: DeptData }) {
  const overdue = dept.tasks.filter((t) => t.dueDate && t.dueDate < new Date() && t.status !== "done").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${dept.name} — Department Command Centre`}
        subtitle={`${dept.subsidiaryName ?? "Ascendium Global Holdings"} · Head: ${dept.headName ?? "—"}`}
      />

      {dept.mission && (
        <p className="card p-4 text-sm italic text-slate-600 dark:text-slate-300">“{dept.mission}”</p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Department overview">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Team members</dt><dd className="font-medium text-navy-deep dark:text-white">{dept.members.length}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Open tasks</dt><dd className="font-medium text-navy-deep dark:text-white">{dept.tasks.length}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Overdue</dt><dd className={`font-medium ${overdue > 0 ? "text-red-600" : "text-navy-deep dark:text-white"}`}>{overdue}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Projects touched</dt><dd className="font-medium text-navy-deep dark:text-white">{dept.projects.length}</dd></div>
          </dl>
        </Card>

        <Card title="Objectives" action={<Link href="/strategy" className="link text-xs">Strategy</Link>}>
          <ul className="space-y-3">
            {dept.objectives.map((o) => (
              <li key={o.id}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium text-navy-deep dark:text-white">{o.title.replace("[DEMO] ", "")}</span>
                  <Pill tone={OBJECTIVE_TONE[o.status] ?? "slate"}>{o.status.replace("_", " ")}</Pill>
                </div>
                <div className="mt-1"><ProgressBar value={o.progressPct} tone={o.status === "off_track" ? "red" : o.status === "at_risk" ? "amber" : "green"} /></div>
              </li>
            ))}
            {dept.objectives.length === 0 && <li className="text-sm text-slate-500">No department objectives yet.</li>}
          </ul>
        </Card>

        <Card title="Morning Brief" action={<Pill tone="gold">AI</Pill>}>
          <p className="font-display text-lg text-navy-deep dark:text-white">{dept.brief.greeting}</p>
          <ul className="mt-3 space-y-2">
            {dept.brief.items.slice(0, 6).map((i) => (
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

      <Card title="Department tasks" action={<Link href="/tasks" className="link text-xs">Task engine</Link>}>
        <Table head={["Task", "Owner", "Status", "Priority", "Due"]}>
          {dept.tasks.slice(0, 10).map((t) => {
            const due = relativeDue(t.dueDate);
            return (
              <RowLink
                key={t.id}
                href="/tasks"
                cells={[
                  t.title,
                  t.ownerName,
                  <StatusPill key="s" status={t.status} />,
                  <StatusPill key="p" status={t.priority} />,
                  <span key="d" className={due.overdue ? "text-xs font-medium text-red-600" : "text-xs text-slate-500"}>{due.label}</span>,
                ]}
              />
            );
          })}
          {dept.tasks.length === 0 && <tr><td className="td text-slate-500" colSpan={5}>No open tasks in this department.</td></tr>}
        </Table>
      </Card>
    </div>
  );
}
