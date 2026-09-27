import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeGroupPulse, computeMorningBrief } from "@/lib/services/pulse";
import GroupDashboard from "@/components/dashboards/group";
import SubsidiaryDashboard from "@/components/dashboards/subsidiary";
import DepartmentDashboard from "@/components/dashboards/department";
import MyAscendium from "@/components/dashboards/my";

const GROUP_ROLES = new Set([
  "GROUP_CEO", "GROUP_EXECUTIVE", "BOARD_MEMBER", "GROUP_CFO", "GROUP_COO", "GROUP_CIO",
  "GROUP_CHRO", "GROUP_GENERAL_COUNSEL", "GROUP_RISK_OFFICER", "GROUP_COMPLIANCE_OFFICER",
]);
const SUBSIDIARY_ROLES = new Set(["SUBSIDIARY_CEO", "MANAGING_DIRECTOR", "CFO", "COO"]);
const DEPARTMENT_ROLES = new Set(["DEPARTMENT_HEAD", "MANAGER"]);

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = (await getCurrentUser())!;
  const orgId = user.organisationId;
  const roleCode = user.role?.code ?? "";

  if (user.isAdmin || user.isExecutive || GROUP_ROLES.has(roleCode)) {
    const [pulse, brief, kpiStrip, subsidiaryCount, peopleCount, openProjects, pendingApprovals] = await Promise.all([
      computeGroupPulse(user),
      computeMorningBrief(user),
      prisma.kpi.findMany({
        where: { organisationId: orgId, standard: true },
        include: { values: { orderBy: { period: "desc" }, take: 1 } },
        orderBy: { name: "asc" },
        take: 6,
      }),
      prisma.subsidiary.count({ where: { organisationId: orgId, status: "active" } }),
      prisma.user.count({ where: { organisationId: orgId, isActive: true } }),
      prisma.project.count({ where: { organisationId: orgId, status: { in: ["planning", "active", "on_hold"] } } }),
      prisma.approval.count({ where: { organisationId: orgId, status: "pending" } }),
    ]);

    return (
      <GroupDashboard
        pulse={pulse}
        brief={brief}
        kpiStrip={kpiStrip.map((k) => ({
          id: k.id,
          name: k.name,
          unit: k.unit,
          latest: k.values[0]?.value ?? null,
          target: k.values[0]?.target ?? null,
          isDemo: k.isDemo,
        }))}
        subsidiaryCount={subsidiaryCount}
        peopleCount={peopleCount}
        openProjects={openProjects}
        pendingApprovals={pendingApprovals}
        executiveName={`${user.firstName} ${user.lastName}`}
      />
    );
  }

  if (user.subsidiaryId && SUBSIDIARY_ROLES.has(roleCode)) {
    const [sub, brief] = await Promise.all([
      prisma.subsidiary.findUnique({
        where: { id: user.subsidiaryId },
        include: {
          cluster: { select: { name: true } },
          kpis: { include: { values: { orderBy: { period: "desc" }, take: 1 } }, take: 6 },
          projects: { orderBy: { updatedAt: "desc" }, take: 8 },
          risks: { where: { status: { in: ["open", "mitigating"] } }, take: 6 },
          departments: { include: { head: { select: { firstName: true, lastName: true } }, users: { select: { id: true }, where: { isActive: true } } }, take: 12 },
        },
      }),
      computeMorningBrief(user),
    ]);
    if (sub) {
      const ceo = await prisma.user.findFirst({
        where: { organisationId: orgId, subsidiaryId: sub.id, title: { contains: "CEO" } },
        select: { firstName: true, lastName: true },
      });
      const revenueKpi = sub.kpis.find((k) => /revenue/i.test(k.name));
      const headcount = await prisma.user.count({ where: { organisationId: orgId, subsidiaryId: sub.id, isActive: true } });
      return (
        <SubsidiaryDashboard
          sub={{
            name: sub.name,
            tagline: sub.description,
            clusterName: sub.cluster?.name ?? "Ungrouped",
            sector: sub.sector,
            ceoName: ceo ? `${ceo.firstName} ${ceo.lastName}` : null,
            isDemo: sub.isDemo,
            revenueLabel: revenueKpi?.values[0] ? `${revenueKpi.values[0].value} ${revenueKpi.unit}` : "—",
            headcount,
            kpis: sub.kpis.map((k) => ({ id: k.id, name: k.name, unit: k.unit, latest: k.values[0]?.value ?? null, target: k.values[0]?.target ?? null })),
            projects: sub.projects.map((p) => ({ id: p.id, name: p.name, code: p.code ?? "", health: p.health, status: p.status, budgetCents: p.budgetCents, spentCents: p.spentCents ?? 0n })),
            risks: sub.risks.map((r) => ({ id: r.id, title: r.title, probability: r.probability, impact: r.impact, status: r.status })),
            departments: sub.departments.map((d) => ({ id: d.id, name: d.name, headName: d.head ? `${d.head.firstName} ${d.head.lastName}` : null, memberCount: d.users.length })),
            brief,
          }}
        />
      );
    }
  }

  if (user.departmentId && DEPARTMENT_ROLES.has(roleCode)) {
    const [dept, brief] = await Promise.all([
      prisma.department.findUnique({
        where: { id: user.departmentId },
        include: {
          subsidiary: { select: { name: true } },
          head: { select: { firstName: true, lastName: true } },
          users: { where: { isActive: true }, select: { id: true, firstName: true, lastName: true, title: true }, take: 12 },
          objectives: { orderBy: { createdAt: "desc" }, take: 6 },
          tasks: { where: { status: { in: ["todo", "in_progress", "blocked", "review"] } }, orderBy: { dueDate: "asc" }, take: 10, include: { owner: { select: { firstName: true, lastName: true } } } },
          projects: { orderBy: { updatedAt: "desc" }, take: 6 },
          kpis: { include: { values: { orderBy: { period: "desc" }, take: 1 } }, take: 6 },
        },
      }),
      computeMorningBrief(user),
    ]);
    if (dept) {
      return (
        <DepartmentDashboard
          dept={{
            name: dept.name,
            mission: dept.mission,
            headName: dept.head ? `${dept.head.firstName} ${dept.head.lastName}` : null,
            subsidiaryName: dept.subsidiary?.name ?? null,
            members: dept.users,
            objectives: dept.objectives.map((o) => ({ id: o.id, title: o.title, status: o.status, progressPct: o.progressPct })),
            tasks: dept.tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate, ownerName: t.owner ? `${t.owner.firstName} ${t.owner.lastName}` : "Unassigned" })),
            projects: dept.projects.map((p) => ({ id: p.id, name: p.name, health: p.health, status: p.status })),
            kpis: dept.kpis.map((k) => ({ id: k.id, name: k.name, unit: k.unit, latest: k.values[0]?.value ?? null, target: k.values[0]?.target ?? null })),
            brief,
          }}
        />
      );
    }
  }

  // Everyone else — personalised employee workspace.
  const [brief, tasks, meetings, objectives, approvals, notifications, announcements, me] = await Promise.all([
    computeMorningBrief(user),
    prisma.task.findMany({
      where: { organisationId: orgId, ownerId: user.id, status: { in: ["todo", "in_progress", "blocked", "review"] } },
      orderBy: [{ dueDate: "asc" }],
      take: 10,
      include: { project: { select: { name: true } } },
    }),
    prisma.meeting.findMany({
      where: { organisationId: orgId, startsAt: { gte: new Date() }, attendees: { some: { userId: user.id } } },
      orderBy: { startsAt: "asc" },
      take: 5,
    }),
    prisma.objective.findMany({ where: { organisationId: orgId, ownerId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.approval.findMany({ where: { organisationId: orgId, approverId: user.id, status: "pending" }, take: 5 }),
    prisma.notification.findMany({ where: { organisationId: orgId, userId: user.id }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.announcement.findMany({ where: { organisationId: orgId }, orderBy: { createdAt: "desc" }, take: 4 }),
    prisma.user.findUnique({
      where: { id: user.id },
      include: {
        manager: { select: { firstName: true, lastName: true } },
        subsidiary: { select: { name: true } },
        department: { select: { name: true } },
        role: { select: { name: true } },
      },
    }),
  ]);

  return (
    <MyAscendium
      data={{
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          title: user.title,
          roleName: me?.role?.name ?? null,
          avatarHue: user.avatarHue,
          managerName: me?.manager ? `${me.manager.firstName} ${me.manager.lastName}` : null,
          subsidiaryName: me?.subsidiary?.name ?? null,
          departmentName: me?.department?.name ?? null,
        },
        todayTasks: tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate, projectName: t.project?.name ?? null })),
        meetings: meetings.map((m) => ({ id: m.id, title: m.title, startsAt: m.startsAt, location: m.location })),
        objectives: objectives.map((o) => ({ id: o.id, title: o.title, status: o.status, progressPct: o.progressPct })),
        approvals: approvals.map((a) => ({ id: a.id, title: a.title, kind: a.kind })),
        notifications: notifications.map((n) => ({ id: n.id, title: n.title, severity: n.severity, createdAt: n.createdAt })),
        announcements: announcements.map((a) => ({ id: a.id, title: a.title, body: a.body, createdAt: a.createdAt })),
      }}
    />
  );
}
