import Link from "next/link";
import { Card, PageHeader, Pill, StatusPill, Table, RowLink, Avatar, ProgressBar } from "@/components/ui";
import { formatDateTime, relativeDue } from "@/lib/format";

type MyData = {
  user: { firstName: string; lastName: string; title: string | null; roleName: string | null; avatarHue: number; managerName: string | null; subsidiaryName: string | null; departmentName: string | null };
  todayTasks: { id: string; title: string; status: string; priority: string; dueDate: Date | null; projectName: string | null }[];
  meetings: { id: string; title: string; startsAt: Date; location: string | null }[];
  objectives: { id: string; title: string; status: string; progressPct: number }[];
  approvals: { id: string; title: string; kind: string }[];
  notifications: { id: string; title: string; severity: string; createdAt: Date }[];
  announcements: { id: string; title: string; body: string | null; createdAt: Date }[];
};

const OBJECTIVE_TONE: Record<string, "green" | "amber" | "red" | "slate"> = { on_track: "green", at_risk: "amber", off_track: "red", achieved: "green", paused: "slate" };

export default function MyAscendium({ data }: { data: MyData }) {
  const u = data.user;
  return (
    <div className="space-y-5">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar first={u.firstName} last={u.lastName} hue={u.avatarHue} size={11} />
            My Ascendium
          </span>
        }
        subtitle={`${u.title ?? ""}${u.title ? " · " : ""}${u.departmentName ?? ""}${u.subsidiaryName ? ` · ${u.subsidiaryName}` : " · Ascendium Global Holdings"}${u.managerName ? ` · Manager: ${u.managerName}` : ""}`}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* My Day */}
        <Card title="My Day" action={<Link href="/tasks" className="link text-xs">All tasks</Link>}>
          <ul className="space-y-2.5">
            {data.todayTasks.slice(0, 7).map((t) => {
              const due = relativeDue(t.dueDate);
              return (
                <li key={t.id} className="rounded-lg border border-slate-200 p-2.5 text-sm dark:border-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 font-medium text-navy-deep dark:text-white">{t.title}</span>
                    <StatusPill status={t.priority} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{t.projectName ?? "Personal"}</span>
                    <span className={due.overdue ? "font-semibold text-red-600" : ""}>{due.label}</span>
                  </div>
                </li>
              );
            })}
            {data.todayTasks.length === 0 && <li className="text-sm text-slate-500">No open tasks — you are clear.</li>}
          </ul>
        </Card>

        {/* Meetings + approvals */}
        <div className="space-y-5">
          <Card title="Upcoming meetings" action={<Link href="/meetings" className="link text-xs">Calendar</Link>}>
            <ul className="space-y-2">
              {data.meetings.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 flex-1 font-medium text-navy-deep dark:text-white">{m.title}</span>
                  <span className="shrink-0 text-xs text-slate-500">{formatDateTime(m.startsAt)}</span>
                </li>
              ))}
              {data.meetings.length === 0 && <li className="text-sm text-slate-500">No meetings scheduled.</li>}
            </ul>
          </Card>

          <Card title="Awaiting my decision" action={<Link href="/approvals" className="link text-xs">Open inbox</Link>}>
            <ul className="space-y-2">
              {data.approvals.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 flex-1 text-navy-deep dark:text-white">{a.title}</span>
                  <Pill tone="gold">{a.kind}</Pill>
                </li>
              ))}
              {data.approvals.length === 0 && <li className="text-sm text-slate-500">Inbox clear.</li>}
            </ul>
          </Card>

          <Card title="Notifications">
            <ul className="space-y-1.5">
              {data.notifications.slice(0, 5).map((n) => (
                <li key={n.id} className="flex items-center gap-2 text-sm">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${n.severity === "critical" ? "bg-red-500" : n.severity === "important" ? "bg-amber-500" : "bg-slate-400"}`} />
                  <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">{n.title}</span>
                </li>
              ))}
              {data.notifications.length === 0 && <li className="text-sm text-slate-500">No notifications.</li>}
            </ul>
          </Card>
        </div>

        {/* Performance + org */}
        <div className="space-y-5">
          <Card title="My objectives" action={<Link href="/strategy" className="link text-xs">Strategy</Link>}>
            <ul className="space-y-3">
              {data.objectives.map((o) => (
                <li key={o.id}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium text-navy-deep dark:text-white">{o.title.replace("[DEMO] ", "")}</span>
                    <Pill tone={OBJECTIVE_TONE[o.status] ?? "slate"}>{o.status.replace("_", " ")}</Pill>
                  </div>
                  <div className="mt-1"><ProgressBar value={o.progressPct} tone={o.status === "off_track" ? "red" : o.status === "at_risk" ? "amber" : "green"} /></div>
                </li>
              ))}
              {data.objectives.length === 0 && <li className="text-sm text-slate-500">No personal objectives assigned yet.</li>}
            </ul>
          </Card>

          <Card title="Announcements" action={<Link href="/announcements" className="link text-xs">All</Link>}>
            <ul className="space-y-2">
              {data.announcements.slice(0, 4).map((a) => (
                <li key={a.id} className="text-sm">
                  <p className="font-medium text-navy-deep dark:text-white">{a.title.replace("[DEMO] ", "")}</p>
                  {a.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{a.body}</p>}
                </li>
              ))}
              {data.announcements.length === 0 && <li className="text-sm text-slate-500">No announcements.</li>}
            </ul>
          </Card>
        </div>
      </div>

      <Card title="My projects">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Projects you belong to appear in the <Link href="/projects" className="link">project portfolio</Link>. Tasks assigned to you are in the{" "}
          <Link href="/tasks" className="link">task engine</Link>, and your learning path lives in the{" "}
          <Link href="/documents" className="link">knowledge library</Link>.
        </p>
      </Card>
    </div>
  );
}
