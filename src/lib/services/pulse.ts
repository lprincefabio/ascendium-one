import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

export type PulseDimension = {
  key: string;
  label: string;
  status: "strong" | "stable" | "attention" | "concern";
  evidence: string;
  drillHref: string;
};

function statusOf(score: number): PulseDimension["status"] {
  if (score >= 80) return "strong";
  if (score >= 65) return "stable";
  if (score >= 50) return "attention";
  return "concern";
}

/**
 * Ascendium Pulse — the institutional health layer. Each dimension is computed
 * from underlying evidence (never a bare red/green) and every reading carries
 * a drill-down link to the records that produced it.
 */
export async function computeGroupPulse(user: SessionUser): Promise<PulseDimension[]> {
  const orgId = user.organisationId;
  const now = new Date();

  const [projects, kpis, risks, tasks, decisions, approvals, objectives, incidents] = await Promise.all([
    prisma.project.findMany({ where: { organisationId: orgId }, select: { health: true, status: true } }),
    prisma.kpi.findMany({ where: { organisationId: orgId }, include: { values: { orderBy: { period: "desc" }, take: 2 } } }),
    prisma.risk.findMany({ where: { organisationId: orgId, status: { in: ["open", "mitigating"] } }, select: { probability: true, impact: true, escalationLevel: true } }),
    prisma.task.findMany({ where: { organisationId: orgId, status: { in: ["todo", "in_progress", "blocked", "review"] } }, select: { dueDate: true, status: true } }),
    prisma.decision.count({ where: { organisationId: orgId, status: "open", deadline: { lt: now } } }),
    prisma.approval.count({ where: { organisationId: orgId, status: "pending" } }),
    prisma.objective.findMany({ where: { organisationId: orgId }, select: { status: true, level: true } }),
    prisma.incident.findMany({ where: { organisationId: orgId }, select: { severity: true, status: true } }),
  ]);

  const pActive = projects.filter((p) => p.status === "active").length || 1;
  const pRed = projects.filter((p) => p.health === "red").length;
  const pAmber = projects.filter((p) => p.health === "amber").length;
  const operational = statusOf(Math.round(100 - ((pRed * 22 + pAmber * 9) / pActive) * 100));

  let kpiOnTrack = 0;
  let kpiCount = 0;
  for (const k of kpis) {
    const latest = k.values[0];
    if (!latest) continue;
    kpiCount++;
    if (k.direction === "up" ? latest.value >= (latest.target ?? latest.value) : latest.value <= (latest.target ?? latest.value)) kpiOnTrack++;
  }
  const financial = statusOf(kpiCount ? Math.round((kpiOnTrack / kpiCount) * 100) : 60);

  const oActive = objectives.filter((o) => o.status !== "achieved" && o.status !== "paused").length || 1;
  const oOff = objectives.filter((o) => o.status === "off_track").length;
  const oRisk = objectives.filter((o) => o.status === "at_risk").length;
  const strategic = statusOf(Math.round(100 - ((oOff * 25 + oRisk * 10) / oActive) * 100));

  const overdue = tasks.filter((t) => t.dueDate && t.dueDate < now).length;
  const blocked = tasks.filter((t) => t.status === "blocked").length;
  const people = statusOf(100 - Math.min(60, overdue * 3 + blocked * 6));

  const highExposure = risks.filter((r) => r.probability * r.impact >= 12).length;
  const escalated = risks.filter((r) => r.escalationLevel === "group" || r.escalationLevel === "board").length;
  const risk = statusOf(100 - Math.min(70, highExposure * 9 + escalated * 12));

  const openIncidents = incidents.filter((i) => i.status !== "resolved" && i.status !== "closed");
  const critical = openIncidents.filter((i) => i.severity === "critical").length;
  const governance = statusOf(decisions + approvals > 8 ? 45 : decisions + approvals > 3 ? 62 : 82);
  const technology = statusOf(openIncidents.length === 0 ? 85 : critical > 0 ? 35 : 65);

  return [
    { key: "financial", label: "Financial health", status: financial, evidence: `${kpiOnTrack} of ${kpiCount} measured KPIs at or beyond target in the latest period.`, drillHref: "/kpis" },
    { key: "operational", label: "Operational health", status: operational, evidence: `${projects.length} projects on record: ${pRed} red, ${pAmber} amber, ${Math.max(0, projects.length - pRed - pAmber)} green/on track.`, drillHref: "/projects" },
    { key: "strategic", label: "Strategic execution", status: strategic, evidence: `${objectives.length} objectives: ${oOff} off track, ${oRisk} at risk, ${objectives.filter((o) => o.status === "achieved").length} achieved.`, drillHref: "/strategy" },
    { key: "people", label: "People health", status: people, evidence: `${tasks.length} open tasks; ${overdue} overdue, ${blocked} blocked.`, drillHref: "/tasks" },
    { key: "risk", label: "Risk exposure", status: risk, evidence: `${risks.length} open risks; ${highExposure} high-exposure (P×I ≥ 12); ${escalated} escalated.`, drillHref: "/risks" },
    { key: "governance", label: "Governance & decisions", status: governance, evidence: `${decisions} decisions past deadline; ${approvals} approvals pending.`, drillHref: "/approvals" },
    { key: "technology", label: "Technology & security", status: technology, evidence: `${openIncidents.length} open incident(s)${critical ? `, ${critical} critical` : ""}.`, drillHref: "/incidents" },
  ];
}

export type BriefItem = { label: string; count: number; detail: string; href: string };
export type MorningBrief = {
  greeting: string;
  items: BriefItem[];
  headline: { title: string; body: string } | null;
  topPriority: string | null;
};

/** The Ascendium Morning Brief — a personalised daily executive briefing. */
export async function computeMorningBrief(user: SessionUser): Promise<MorningBrief> {
  const orgId = user.organisationId;
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000);
  const isGroupExec = user.isExecutive || user.isAdmin;

  const scope = isGroupExec || !user.subsidiaryId ? {} : { OR: [{ subsidiaryId: user.subsidiaryId }, { subsidiaryId: null }] };

  const [decisions, approvals, risks, escalations, projects, meetings, tasksDue, unreadNotifs] = await Promise.all([
    prisma.decision.findMany({
      where: { organisationId: orgId, ...scope, status: "open", ...(isGroupExec ? { deadline: { lte: in48h } } : {}) },
      orderBy: { deadline: "asc" }, take: 5,
    }),
    prisma.approval.findMany({ where: { organisationId: orgId, ...scope, status: "pending", ...(isGroupExec ? {} : { requesterId: user.id }) }, take: 5 }),
    prisma.risk.findMany({ where: { organisationId: orgId, ...scope, status: "open", probability: { gte: 4 }, impact: { gte: 4 } }, take: 3 }),
    prisma.issue.count({ where: { organisationId: orgId, ...scope, status: "escalated" } }),
    prisma.project.findMany({ where: { organisationId: orgId, ...scope, health: "red", status: "active" }, take: 3 }),
    prisma.meeting.findMany({ where: { organisationId: orgId, startsAt: { gte: now, lte: in48h } }, orderBy: { startsAt: "asc" }, take: 5 }),
    prisma.task.count({ where: { organisationId: orgId, ownerId: user.id, status: { in: ["todo", "in_progress", "review"] }, dueDate: { lte: in48h } } }),
    prisma.notification.count({ where: { organisationId: orgId, userId: user.id, readAt: null } }),
  ]);

  const items: BriefItem[] = [];
  if (isGroupExec) {
    items.push({ label: "Strategic decisions approaching deadline", count: decisions.length, detail: decisions.map((d) => d.title).join(" · ") || "None due within 48 hours.", href: "/decisions" });
    items.push({ label: "Approvals awaiting decision", count: approvals.length, detail: approvals.slice(0, 3).map((a) => a.title).join(" · ") || "Inbox clear.", href: "/approvals" });
  } else {
    items.push({ label: "Open decisions in your scope", count: decisions.length, detail: decisions.slice(0, 3).map((d) => d.title).join(" · ") || "None.", href: "/decisions" });
    items.push({ label: "Requests you are tracking", count: approvals.length, detail: approvals.slice(0, 3).map((a) => a.title).join(" · ") || "None.", href: "/approvals" });
  }
  items.push({ label: "Emerging high-exposure risks", count: risks.length, detail: risks.map((r) => r.title).join(" · ") || "No P4×I4+ risks open.", href: "/risks" });
  items.push({ label: "Unresolved escalations", count: escalations, detail: escalations > 0 ? "Institutional issues requiring executive attention." : "No escalated issues.", href: "/issues" });
  items.push({ label: "Projects in red health", count: projects.length, detail: projects.map((p) => p.name).join(" · ") || "No active project is red.", href: "/projects" });
  items.push({ label: "Meetings in the next 48 hours", count: meetings.length, detail: meetings.map((m) => m.title).join(" · ") || "No meetings scheduled.", href: "/meetings" });
  items.push({ label: "Your tasks due within 48 hours", count: tasksDue, detail: tasksDue > 0 ? "Review My Ascendium to re-sequence." : "Nothing urgent due.", href: "/" });
  items.push({ label: "Unread notifications", count: unreadNotifs, detail: unreadNotifs > 0 ? "Check the notification centre." : "You are fully caught up.", href: "/" });

  const headline =
    decisions.length > 0
      ? { title: "Highest-priority institutional decision", body: decisions[0].title }
      : risks.length > 0
        ? { title: "Highest-priority institutional risk", body: risks[0].title }
        : projects.length > 0
          ? { title: "Project requiring intervention", body: projects[0].name }
          : null;

  return {
    greeting: `Good morning, ${user.firstName}.`,
    items,
    headline,
    topPriority: headline ? headline.body : null,
  };
}
