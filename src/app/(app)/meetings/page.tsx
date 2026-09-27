import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { assertCan, scopeWhere } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, EmptyState, PageHeader, Pill, StatusPill } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const user = (await getCurrentUser())!;
  assertCan(user, "meeting", "read");

  const scope = scopeWhere(user, "meeting", "read") as Prisma.MeetingWhereInput;
  const now = new Date();
  const [upcoming, past] = await Promise.all([
    prisma.meeting.findMany({
      where: { organisationId: user.organisationId, ...scope, startsAt: { gte: now }, status: { in: ["scheduled", "live"] } },
      include: {
        owner: { select: { firstName: true, lastName: true } },
        attendees: { include: { user: { select: { firstName: true, lastName: true } } }, take: 8 },
        actionItems: { where: { done: false }, take: 5 },
        project: { select: { name: true } },
      },
      orderBy: { startsAt: "asc" },
      take: 50,
    }),
    prisma.meeting.findMany({
      where: { organisationId: user.organisationId, ...scope, OR: [{ startsAt: { lt: now } }, { status: "completed" }] },
      include: { owner: { select: { firstName: true, lastName: true } } },
      orderBy: { startsAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div>
      <PageHeader title="Meetings" subtitle={`${upcoming.length} upcoming in your scope`} />

      <div className="space-y-5">
        <Card title="Upcoming">
          {upcoming.length === 0 ? (
            <EmptyState title="No upcoming meetings in your scope" />
          ) : (
            <ul className="space-y-3">
              {upcoming.map((m) => (
                <li key={m.id} className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-navy-deep dark:text-white">
                        {m.title}
                        {m.isDemo && <Pill tone="gold">demo</Pill>}
                        <StatusPill status={m.status} />
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatDateTime(m.startsAt)}
                        {m.endsAt && ` – ${formatDateTime(m.endsAt)}`}
                        {m.location && ` · ${m.location}`}
                        {m.project && ` · ${m.project.name}`}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">Owner: {m.owner ? `${m.owner.firstName} ${m.owner.lastName}` : "—"}</span>
                  </div>
                  {m.purpose && <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{m.purpose}</p>}
                  {m.agenda && (
                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/5 dark:text-slate-300">
                      <span className="font-semibold uppercase tracking-wide text-slate-500">Agenda</span>
                      {"\n"}{m.agenda}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {m.attendees.map((a) => (
                      <Pill key={a.id} tone={a.rsvp === "declined" ? "red" : a.rsvp === "accepted" ? "green" : "slate"}>
                        {a.user.firstName} {a.user.lastName}
                      </Pill>
                    ))}
                    {m.actionItems.length > 0 && <Pill tone="amber">{m.actionItems.length} open action item{m.actionItems.length === 1 ? "" : "s"}</Pill>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Past meetings">
          {past.length === 0 ? (
            <EmptyState title="No past meetings in your scope" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {past.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-navy-deep dark:text-white">{m.title}</span>
                    <span className="text-xs text-slate-500">{formatDate(m.startsAt)} · {m.owner ? `${m.owner.firstName} ${m.owner.lastName}` : "—"}</span>
                  </span>
                  <StatusPill status={m.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
