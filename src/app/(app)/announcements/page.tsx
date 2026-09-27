import { getCurrentUser, permissionLevelFor } from "@/lib/auth";
import { assertCan } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, EmptyState, PageHeader, Pill } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { AnnouncementPublish } from "@/components/forms";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const user = (await getCurrentUser())!;
  assertCan(user, "announcement", "read");

  const announcements = await prisma.announcement.findMany({
    where: {
      organisationId: user.organisationId,
      OR: [
        { audience: "group" },
        { audience: "subsidiary", audienceId: user.subsidiaryId ?? "" },
        { audience: "department", audienceId: user.departmentId ?? "" },
      ],
    },
    include: { author: { select: { firstName: true, lastName: true, title: true } } },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  const canPublish = permissionLevelFor(user, "announcement", "create") !== null;

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle="Broadcasts from group, subsidiary and department leadership"
        actions={canPublish ? <AnnouncementPublish /> : undefined}
      />

      {announcements.length === 0 ? (
        <Card><EmptyState title="No announcements for your audience" /></Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <Card key={a.id} className={a.pinned ? "border-l-4 !border-l-gold" : ""}>
              <div className="flex flex-wrap items-center gap-2">
                {a.pinned && <Pill tone="gold">Pinned</Pill>}
                <Pill tone={a.audience === "group" ? "teal" : "slate"}>{a.audience}</Pill>
                {a.isDemo && <Pill tone="gold">demo</Pill>}
                <h2 className="font-display text-base font-semibold text-navy-deep dark:text-white">{a.title}</h2>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{a.body}</p>
              <p className="mt-3 text-xs text-slate-500">
                {a.author ? `${a.author.firstName} ${a.author.lastName}${a.author.title ? ` · ${a.author.title}` : ""}` : "Ascendium Global Holdings"}
                {" · "}{formatDate(a.createdAt)}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
