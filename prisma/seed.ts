/**
 * Ascendium One — database seed.
 *
 * Creates the Ascendium Global Holdings organisation exactly as published at
 * ascendiumventures.org (five clusters, nineteen enterprises), the complete
 * role catalogue, and a realistic but clearly labelled DEMO operating layer:
 * executives, employees, projects, KPIs with monthly metrics, risks,
 * decisions, approvals, documents, meetings, announcements and more.
 *
 * Every synthetic record carries the DEMO_LABEL prefix in its title/name and
 * isDemo=true. Nothing here is presented as real financial, employee or
 * operational data.
 *
 * Demo sign-in (all demo accounts):  see README.md
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ROLE_DEFS } from "./roles";
import { ORG, CLUSTERS, SUBSIDIARIES, GROUP_EXECUTIVES, ADMIN_IDENTITY } from "./org";

const prisma = new PrismaClient();

const DEMO = process.env.DEMO_LABEL ?? "[DEMO]";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Ascendium#Demo1";

// Deterministic PRNG so every seed run produces the same demo numbers.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20250927);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const intBetween = (min: number, max: number) => Math.round(between(min, max));
const daysFromNow = (days: number, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
};

async function wipe() {
  const order = [
    "workflowInstance",
    "workflow",
    "aIInteraction",
    "auditEvent",
    "notification",
    "announcement",
    "message",
    "channel",
    "meetingActionItem",
    "meetingAttendee",
    "meeting",
    "knowledgeItem",
    "documentVersion",
    "document",
    "metric",
    "keyResult",
    "kpi",
    "objective",
    "taskComment",
    "task",
    "projectMember",
    "project",
    "approval",
    "decision",
    "risk",
    "issue",
    "incident",
    "opportunity",
    "loginEvent",
    "session",
    "userSkill",
    "user",
    "team",
    "department",
    "subsidiary",
    "cluster",
    "role",
    "organisation",
  ] as const;
  for (const model of order) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any)[model].deleteMany();
  }
}

async function main() {
  console.log(`[seed] Ascendium One — seeding ${ORG.name} (${DEMO})`);
  await wipe();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const org = await prisma.organisation.create({
    data: {
      name: ORG.name,
      legalName: ORG.legalName,
      tagline: ORG.tagline,
      mission: ORG.mission,
      vision: ORG.vision,
      foundedYear: ORG.foundedYear,
      isDemo: false,
    },
  });

  const roles = new Map<string, string>();
  for (const def of ROLE_DEFS) {
    const role = await prisma.role.create({
      data: {
        organisationId: org.id,
        code: def.code,
        name: def.name,
        level: def.level,
        description: def.description,
        isSystem: def.isSystem ?? false,
        permissions: JSON.stringify(def.permissions),
      },
    });
    roles.set(def.code, role.id);
  }
  const roleId = (code: string) => roles.get(code)!;

  const clusters = new Map<string, string>();
  for (let i = 0; i < CLUSTERS.length; i++) {
    const c = CLUSTERS[i];
    const cluster = await prisma.cluster.create({
      data: {
        organisationId: org.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        sortOrder: i,
        isDemo: false,
      },
    });
    clusters.set(c.slug, cluster.id);
  }

  type SubContext = {
    id: string;
    clusterSlug: string;
    departments: Map<string, { id: string; name: string }>;
    ceoId: string;
  };
  const subs = new Map<string, SubContext>();

  for (const def of SUBSIDIARIES) {
    const sub = await prisma.subsidiary.create({
      data: {
        organisationId: org.id,
        clusterId: clusters.get(def.cluster)!,
        name: def.name,
        slug: def.slug,
        sector: def.sector,
        description: def.description,
        isDemo: false,
      },
    });

    const departments = new Map<string, { id: string; name: string }>();
    for (const deptName of def.departments) {
      const dept = await prisma.department.create({
        data: {
          organisationId: org.id,
          subsidiaryId: sub.id,
          name: deptName,
          slug: deptName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          budgetCents: BigInt(intBetween(8_000_000_00, 120_000_000_00)),
          isDemo: false,
        },
      });
      departments.set(deptName, { id: dept.id, name: deptName });
    }

    const ceo = await prisma.user.create({
      data: {
        organisationId: org.id,
        subsidiaryId: sub.id,
        roleId: roleId("SUBSIDIARY_CEO"),
        email: `${def.ceoFirst}.${def.ceoLast}@ascendium.local`.toLowerCase().replace(/[^a-z0-9.@]/g, ""),
        passwordHash,
        firstName: def.ceoFirst,
        lastName: def.ceoLast,
        title: `Chief Executive Officer, ${def.name}`,
        isExecutive: true,
        isDemo: true,
        avatarHue: intBetween(0, 360),
      },
    });

    subs.set(def.slug, { id: sub.id, clusterSlug: def.cluster, departments, ceoId: ceo.id });
  }

  // Group executive floor — Leon Kayanda first.
  const execDept = await prisma.department.create({
    data: {
      organisationId: org.id,
      name: "Group Executive Office",
      slug: "group-executive-office",
      mission: "Steward the whole institution: strategy, capital, people, governance.",
      isDemo: false,
    },
  });

  const groupExecIds: string[] = [];
  let leonId = "";
  for (const exec of GROUP_EXECUTIVES) {
    const user = await prisma.user.create({
      data: {
        organisationId: org.id,
        departmentId: execDept.id,
        roleId: roleId(exec.roleCode),
        email: `${exec.first}.${exec.last}@ascendium.local`.toLowerCase().replace(/[^a-z0-9.@]/g, ""),
        passwordHash,
        firstName: exec.first,
        lastName: exec.last,
        title: exec.title,
        isExecutive: true,
        isDemo: true,
        avatarHue: intBetween(0, 360),
      },
    });
    groupExecIds.push(user.id);
    if (exec.roleCode === "GROUP_CEO") leonId = user.id;
  }

  const admin = await prisma.user.create({
    data: {
      organisationId: org.id,
      departmentId: execDept.id,
      roleId: roleId("SYSTEM_ADMINISTRATOR"),
      email: ADMIN_IDENTITY.email,
      passwordHash,
      firstName: ADMIN_IDENTITY.first,
      lastName: ADMIN_IDENTITY.last,
      title: ADMIN_IDENTITY.title,
      isAdmin: true,
      isDemo: true,
      avatarHue: 45,
    },
  });
  void admin;

  // Department heads + employees in a representative set of subsidiaries.
  const FIRST = ["Aisha", "Bongani", "Chloe", "David", "Elena", "Femi", "Greta", "Hassan", "Irene", "Jamal", "Katarina", "Liam", "Maya", "Noah", "Olga", "Peter", "Quinn", "Rosa", "Samuel", "Tessa", "Umar", "Vera", "Wesley", "Ximena", "Yara", "Zola"] as const;
  const LAST = ["Abara", "Botha", "Chanda", "Dube", "Ekwueme", "Fontaine", "Gumede", "Hadebe", "Iwu", "Juma", "Kamau", "Lubbe", "Moyo", "Ndiaye", "Okafor", "Pillay", "Qureshi", "Radebe", "Sissoko", "Thwala", "Uche", "Vilakazi", "Wakaba", "Xaba", "Yates", "Zulu"] as const;
  const usedNames = new Set<string>();
  const makeName = () => {
    for (;;) {
      const f = pick(FIRST);
      const l = pick(LAST);
      const key = `${f} ${l}`;
      if (!usedNames.has(key)) {
        usedNames.add(key);
        return { first: f, last: l };
      }
    }
  };

  const employeeIdsBySub = new Map<string, string[]>();
  const headIdsByDept = new Map<string, string>();

  for (const def of SUBSIDIARIES) {
    const ctx = subs.get(def.slug)!;
    const deptEntries = [...ctx.departments.entries()];
    const subEmployees: string[] = [];
    // A department head per department (demo).
    for (const [deptName, dept] of deptEntries) {
      const { first, last } = makeName();
      const head = await prisma.user.create({
        data: {
          organisationId: org.id,
          subsidiaryId: ctx.id,
          departmentId: dept.id,
          managerId: ctx.ceoId,
          roleId: roleId("DEPARTMENT_HEAD"),
          email: `${first}.${last}@ascendium.local`.toLowerCase(),
          passwordHash,
          firstName: first,
          lastName: last,
          title: `Head of ${deptName}`,
          isDemo: true,
          avatarHue: intBetween(0, 360),
        },
      });
      headIdsByDept.set(dept.id, head.id);
      await prisma.department.update({
        where: { id: dept.id },
        data: { headId: head.id },
      });
      subEmployees.push(head.id);

      // Two employees per department in the showcase subsidiaries.
      if (["ascendium-academia", "ascendium-energy", "ascendium-cyber-defence", "ascendium-think-tank", "ascendium-digital-exchange"].includes(def.slug)) {
        for (let i = 0; i < 2; i++) {
          const n = makeName();
          const emp = await prisma.user.create({
            data: {
              organisationId: org.id,
              subsidiaryId: ctx.id,
              departmentId: dept.id,
              managerId: head.id,
              roleId: roleId("EMPLOYEE"),
              email: `${n.first}.${n.last}@ascendium.local`.toLowerCase(),
              passwordHash,
              firstName: n.first,
              lastName: n.last,
              title: `${deptName} Associate`,
              isDemo: true,
              avatarHue: intBetween(0, 360),
            },
          });
          subEmployees.push(emp.id);
        }
      }
    }
    employeeIdsBySub.set(ctx.id, subEmployees);
  }

  // ------------------------------------------------------------------
  // Strategy: group objectives cascade
  // ------------------------------------------------------------------
  const groupObjectives: { id: string; title: string; level: string; status: string; progress: number; due: Date; kris: { title: string; target: number; unit: string; current: number }[] }[] = [
    {
      id: "",
      title: "Consolidate the 19 enterprises into one governed operating ecosystem",
      level: "group",
      status: "on_track",
      progress: 68,
      due: daysFromNow(95),
      kris: [
        { title: "Enterprises live on Ascendium One", target: 19, unit: "subsidiaries", current: 19 },
        { title: "Executives with daily brief adoption", target: 90, unit: "%", current: 74 },
      ],
    },
    {
      id: "",
      title: "Achieve group revenue of $1.2B with disciplined capital allocation",
      level: "group",
      status: "on_track",
      progress: 61,
      due: daysFromNow(150),
      kris: [
        { title: "Group revenue run-rate", target: 1200, unit: "USDm", current: 731 },
        { title: "Portfolio ROI", target: 18, unit: "%", current: 15.2 },
      ],
    },
    {
      id: "",
      title: "Embed AI governance as a market-defining institutional capability",
      level: "group",
      status: "on_track",
      progress: 72,
      due: daysFromNow(200),
      kris: [
        { title: "Client institutions on the evidence journey", target: 40, unit: "institutions", current: 27 },
      ],
    },
    {
      id: "",
      title: "Strengthen institutional risk posture across all clusters",
      level: "group",
      status: "at_risk",
      progress: 44,
      due: daysFromNow(120),
      kris: [
        { title: "Group-level risks with active mitigation", target: 95, unit: "%", current: 71 },
      ],
    },
  ];

  const objectiveIds: string[] = [];
  for (const o of groupObjectives) {
    const created = await prisma.objective.create({
      data: {
        organisationId: org.id,
        ownerId: leonId,
        title: `${DEMO} ${o.title}`,
        level: o.level,
        status: o.status,
        progressPct: o.progress,
        dueDate: o.due,
        isDemo: true,
      },
    });
    o.id = created.id;
    objectiveIds.push(created.id);
    for (const kr of o.kris) {
      await prisma.keyResult.create({
        data: {
          objectiveId: created.id,
          title: kr.title,
          targetValue: kr.target,
          currentValue: kr.current,
          unit: kr.unit,
        },
      });
    }
  }

  // Subsidiary-level objectives for showcase subsidiaries.
  const showcaseSubs = ["ascendium-energy", "ascendium-academia", "ascendium-cyber-defence", "ascendium-digital-exchange", "ascendium-transport", "ascendium-lifescience-biotech"];
  const subObjectiveTitles: Record<string, string> = {
    "ascendium-energy": "Deliver 240MW of new generation capacity across the renewable pipeline",
    "ascendium-academia": "Enrol 5,000 learners across flagship programmes with 90% completion",
    "ascendium-cyber-defence": "Stand up the 24/7 security operations capability and first external clients",
    "ascendium-digital-exchange": "Launch v1 of the digital exchange with 10,000 registered participants",
    "ascendium-transport": "Modernise 30% of the regional fleet and improve on-time performance to 92%",
    "ascendium-lifescience-biotech": "Advance two research programmes to pre-clinical milestones",
  };
  for (const slug of showcaseSubs) {
    const ctx = subs.get(slug)!;
    await prisma.objective.create({
      data: {
        organisationId: org.id,
        subsidiaryId: ctx.id,
        ownerId: ctx.ceoId,
        parentId: objectiveIds[1],
        title: `${DEMO} ${subObjectiveTitles[slug]}`,
        level: "subsidiary",
        status: pick(["on_track", "on_track", "at_risk"] as const),
        progressPct: intBetween(35, 75),
        dueDate: daysFromNow(intBetween(80, 160)),
        isDemo: true,
      },
    });
  }

  // ------------------------------------------------------------------
  // KPIs + monthly metrics (2026-01 .. 2026-09)
  // ------------------------------------------------------------------
  const MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];

  const groupKpis = [
    { name: "Group Revenue", category: "financial", unit: "USDm", direction: "up", base: 58, growth: 3.2 },
    { name: "EBITDA Margin", category: "financial", unit: "%", direction: "up", base: 21.4, growth: 0.25 },
    { name: "Cash & Equivalents", category: "financial", unit: "USDm", direction: "up", base: 214, growth: 6.5 },
    { name: "Group Headcount", category: "employee", unit: "people", direction: "up", base: 1180, growth: 14 },
    { name: "Strategic Execution Index", category: "strategic", unit: "index", direction: "up", base: 62, growth: 1.1 },
    { name: "Open Group-Level Risks", category: "compliance", unit: "risks", direction: "down", base: 14, growth: -0.4 },
  ] as const;

  const kpiIds: string[] = [];
  for (const k of groupKpis) {
    const kpi = await prisma.kpi.create({
      data: {
        organisationId: org.id,
        ownerId: leonId,
        name: `${DEMO} ${k.name}`,
        category: k.category,
        unit: k.unit,
        direction: k.direction,
        standard: true,
        isDemo: true,
      },
    });
    kpiIds.push(kpi.id);
    for (const [i, period] of MONTHS.entries()) {
      const trend = k.base + k.growth * i + between(-1.5, 1.5);
      await prisma.metric.create({
        data: {
          organisationId: org.id,
          kpiId: kpi.id,
          period,
          value: Math.round(trend * 100) / 100,
          target: Math.round((k.base + k.growth * 11) * 100) / 100,
          isDemo: true,
        },
      });
    }
  }

  // Per-subsidiary standard KPIs: Revenue + Operating Margin for all 19.
  for (const def of SUBSIDIARIES) {
    const ctx = subs.get(def.slug)!;
    const rev = await prisma.kpi.create({
      data: {
        organisationId: org.id,
        subsidiaryId: ctx.id,
        name: `${DEMO} ${def.name} — Revenue`,
        category: "financial",
        unit: "USDm",
        direction: "up",
        standard: true,
        ownerId: ctx.ceoId,
        isDemo: true,
      },
    });
    const margin = await prisma.kpi.create({
      data: {
        organisationId: org.id,
        subsidiaryId: ctx.id,
        name: `${DEMO} ${def.name} — Operating Margin`,
        category: "financial",
        unit: "%",
        direction: "up",
        standard: true,
        ownerId: ctx.ceoId,
        isDemo: true,
      },
    });
    const revBase = between(4, 90);
    const marginBase = between(4, 32);
    for (const [i, period] of MONTHS.entries()) {
      await prisma.metric.create({
        data: {
          organisationId: org.id,
          kpiId: rev.id,
          subsidiaryId: ctx.id,
          period,
          value: Math.round((revBase * (1 + 0.04 * i) + between(-2, 2)) * 100) / 100,
          isDemo: true,
        },
      });
      await prisma.metric.create({
        data: {
          organisationId: org.id,
          kpiId: margin.id,
          subsidiaryId: ctx.id,
          period,
          value: Math.round((marginBase + between(-1.5, 1.5)) * 100) / 100,
          isDemo: true,
        },
      });
    }
  }

  // ------------------------------------------------------------------
  // Projects
  // ------------------------------------------------------------------
  type ProjectSeed = {
    code: string;
    name: string;
    sub: string;
    dept: string;
    status: string;
    health: string;
    priority: string;
    progress: number;
    budgetM: number;
    startDays: number;
    dueDays: number;
    cross?: string[];
    description: string;
  };

  const projects: ProjectSeed[] = [
    {
      code: "PRJ-ATLAS",
      name: "Project Atlas — Group Operating Platform",
      sub: "ascendium-digital-exchange",
      dept: "Platform Engineering",
      status: "active",
      health: "green",
      priority: "critical",
      progress: 64,
      budgetM: 14.2,
      startDays: -120,
      dueDays: 75,
      cross: ["ascendium-cyber-defence", "ascendium-consulting-investments"],
      description: "Delivery of Ascendium One, the institutional operating system unifying the group.",
    },
    {
      code: "PRJ-HELIOS",
      name: "Project Helios — Solar Initiative",
      sub: "ascendium-energy",
      dept: "Asset Development",
      status: "active",
      health: "amber",
      priority: "high",
      progress: 47,
      budgetM: 86,
      startDays: -200,
      dueDays: 160,
      cross: ["ascendium-capital-partners"],
      description: "120MW solar generation programme across two sites, including grid interconnection.",
    },
    {
      code: "PRJ-AEGIS",
      name: "Project Aegis — 24/7 Cyber Operations",
      sub: "ascendium-cyber-defence",
      dept: "Security Operations",
      status: "active",
      health: "green",
      priority: "high",
      progress: 58,
      budgetM: 9.6,
      startDays: -90,
      dueDays: 100,
      description: "Stand up the security operations centre, incident response retainer and threat-intelligence feed.",
    },
    {
      code: "PRJ-LEDGER",
      name: "Project Ledger — Exchange v1 Launch",
      sub: "ascendium-digital-exchange",
      dept: "Product",
      status: "active",
      health: "amber",
      priority: "critical",
      progress: 71,
      budgetM: 11.3,
      startDays: -150,
      dueDays: 45,
      description: "Public launch of the Ascendium Digital Exchange marketplace with payments and onboarding.",
    },
    {
      code: "PRJ-ERPI",
      name: "Education, Research & Publishing Initiative",
      sub: "ascendium-academia",
      dept: "Research",
      status: "active",
      health: "green",
      priority: "medium",
      progress: 39,
      budgetM: 4.8,
      startDays: -70,
      dueDays: 210,
      cross: ["ascendium-think-tank", "ascendium-digital-media-publishing"],
      description: "Cross-subsidiary initiative joining Academia, Think Tank and Digital Media on curriculum, research and publishing.",
    },
    {
      code: "PRJ-FLEET",
      name: "Regional Fleet Modernisation",
      sub: "ascendium-transport",
      dept: "Fleet Operations",
      status: "active",
      health: "amber",
      priority: "medium",
      progress: 52,
      budgetM: 32,
      startDays: -180,
      dueDays: 130,
      description: "Replace 30% of the ageing regional fleet with telematics-equipped vehicles.",
    },
    {
      code: "PRJ-DEEPPORT",
      name: "DeepPort Expansion — Berth 4",
      sub: "ascendium-oceanic-logistics",
      dept: "Port Operations",
      status: "on_hold",
      health: "red",
      priority: "medium",
      progress: 33,
      budgetM: 120,
      startDays: -300,
      dueDays: 300,
      description: "Fourth berth construction and crane automation; on hold pending environmental permit.",
    },
    {
      code: "PRJ-BIOME",
      name: "Programme Biome — Metagenomics Platform",
      sub: "ascendium-lifescience-biotech",
      dept: "Research",
      status: "active",
      health: "green",
      priority: "high",
      progress: 44,
      budgetM: 18.5,
      startDays: -110,
      dueDays: 190,
      cross: ["ascendium-academia"],
      description: "Metagenomics discovery platform with Academia co-authored research streams.",
    },
    {
      code: "PRJ-SKYWARD",
      name: "Skyward — Aeromarine Unmanned Systems",
      sub: "ascendium-aeromarine-horizons",
      dept: "Flight Systems",
      status: "planning",
      health: "green",
      priority: "medium",
      progress: 18,
      budgetM: 27,
      startDays: -40,
      dueDays: 320,
      description: "Concept phase for long-range unmanned aerial and surface platforms.",
    },
    {
      code: "PRJ-SCHOOLS50",
      name: "Schools50 Rollout",
      sub: "ascendium-global-schools",
      dept: "School Operations",
      status: "active",
      health: "green",
      priority: "high",
      progress: 66,
      budgetM: 22,
      startDays: -220,
      dueDays: 140,
      description: "Open ten new campuses across three regions with the standardised learning model.",
    },
    {
      code: "PRJ-ENDOW",
      name: "Intergenerational Endowment Structure",
      sub: "ascendium-sovereign-wealth-fund",
      dept: "Portfolio Strategy",
      status: "active",
      health: "green",
      priority: "high",
      progress: 81,
      budgetM: 6.2,
      startDays: -260,
      dueDays: 60,
      description: "Legal and portfolio architecture for the 100-year endowment mandate.",
    },
  ];

  const projectRows = new Map<string, { id: string; seed: ProjectSeed }>();
  for (const p of projects) {
    const ctx = subs.get(p.sub)!;
    const dept = ctx.departments.get(p.dept)!;
    const row = await prisma.project.create({
      data: {
        organisationId: org.id,
        subsidiaryId: ctx.id,
        departmentId: dept.id,
        code: p.code,
        name: `${DEMO} ${p.name}`,
        description: p.description,
        status: p.status,
        health: p.health,
        priority: p.priority,
        progressPct: p.progress,
        budgetCents: BigInt(Math.round(p.budgetM * 1_000_000_00)),
        spentCents: BigInt(Math.round(p.budgetM * 1_000_000_00 * (p.progress / 100) * 0.97)),
        startDate: daysFromNow(p.startDays),
        dueDate: daysFromNow(p.dueDays),
        isCrossSubsidiary: (p.cross?.length ?? 0) > 0,
        isDemo: true,
      },
    });
    projectRows.set(p.code, { id: row.id, seed: p });

    const memberPool = [
      ctx.ceoId,
      headIdsByDept.get(dept.id)!,
      ...(employeeIdsBySub.get(ctx.id) ?? []),
      ...groupExecIds.slice(1, 4),
    ].filter(Boolean);
    const members = [...new Set(memberPool)].slice(0, 6);
    for (const userId of members) {
      await prisma.projectMember.create({
        data: { projectId: row.id, userId, role: userId === ctx.ceoId ? "sponsor" : "member" },
      });
    }
  }

  // ------------------------------------------------------------------
  // Tasks
  // ------------------------------------------------------------------
  type TaskSeed = {
    project: string;
    title: string;
    owner: "ceo" | "head" | "employee";
    status: string;
    priority: string;
    dueDays: number;
    dept?: string;
  };
  const taskSeeds: TaskSeed[] = [
    { project: "PRJ-HELIOS", title: "Finalize EPC contract for Site B", owner: "ceo", status: "review", priority: "critical", dueDays: -2 },
    { project: "PRJ-HELIOS", title: "Grid interconnection application submission", owner: "head", status: "in_progress", priority: "high", dueDays: 6 },
    { project: "PRJ-HELIOS", title: "Procure inverter supply (LOT 3)", owner: "employee", status: "blocked", priority: "high", dueDays: -5 },
    { project: "PRJ-HELIOS", title: "Community engagement — host municipalities", owner: "employee", status: "todo", priority: "medium", dueDays: 21 },
    { project: "PRJ-AEGIS", title: "SOC tooling selection memo", owner: "head", status: "review", priority: "high", dueDays: 1 },
    { project: "PRJ-AEGIS", title: "Incident response retainer — legal review", owner: "employee", status: "in_progress", priority: "medium", dueDays: 12 },
    { project: "PRJ-LEDGER", title: "Payments gateway certification", owner: "employee", status: "blocked", priority: "critical", dueDays: -3 },
    { project: "PRJ-LEDGER", title: "Onboarding funnel usability testing", owner: "head", status: "in_progress", priority: "high", dueDays: 9 },
    { project: "PRJ-LEDGER", title: "Launch pricing approval pack", owner: "ceo", status: "todo", priority: "high", dueDays: 14 },
    { project: "PRJ-ATLAS", title: "RBAC permission matrix sign-off", owner: "head", status: "done", priority: "high", dueDays: -10 },
    { project: "PRJ-ATLAS", title: "Subsidiary data migration dry-run", owner: "employee", status: "in_progress", priority: "high", dueDays: 4 },
    { project: "PRJ-ATLAS", title: "Executive dashboard UAT with Group COO", owner: "ceo", status: "todo", priority: "medium", dueDays: 18 },
    { project: "PRJ-ERPI", title: "Joint curriculum working group charter", owner: "head", status: "in_progress", priority: "medium", dueDays: 11 },
    { project: "PRJ-ERPI", title: "Publishing rights framework draft", owner: "employee", status: "todo", priority: "medium", dueDays: 25 },
    { project: "PRJ-FLEET", title: "Telematics vendor due diligence", owner: "employee", status: "done", priority: "medium", dueDays: -15 },
    { project: "PRJ-FLEET", title: "Financing term sheet — EXIM facility", owner: "ceo", status: "review", priority: "high", dueDays: 2 },
    { project: "PRJ-DEEPPORT", title: "Environmental permit resubmission", owner: "ceo", status: "blocked", priority: "critical", dueDays: -8 },
    { project: "PRJ-BIOME", title: "Sequencing partner MoU", owner: "head", status: "in_progress", priority: "medium", dueDays: 16 },
    { project: "PRJ-SCHOOLS50", title: "Campus 7 site handover", owner: "employee", status: "done", priority: "high", dueDays: -6 },
    { project: "PRJ-SCHOOLS50", title: "Teacher certification cohort 3", owner: "head", status: "in_progress", priority: "medium", dueDays: 30 },
    { project: "PRJ-ENDOW", title: "Endowment governance policy to Board", owner: "ceo", status: "review", priority: "high", dueDays: 3 },
    { project: "PRJ-SKYWARD", title: "Concept design review — propulsion", owner: "head", status: "todo", priority: "low", dueDays: 40 },
  ];

  const taskRows: { id: string; title: string; status: string; ownerId: string; dueDate: Date; projectCode: string }[] = [];
  for (const t of taskSeeds) {
    const proj = projectRows.get(t.project)!;
    const ctx = subs.get(proj.seed.sub)!;
    const dept = ctx.departments.get(proj.seed.dept)!;
    const pool = employeeIdsBySub.get(ctx.id) ?? [];
    const ownerId =
      t.owner === "ceo" ? ctx.ceoId : t.owner === "head" ? headIdsByDept.get(dept.id)! : pool[2] ?? pool[0] ?? ctx.ceoId;
    const row = await prisma.task.create({
      data: {
        organisationId: org.id,
        subsidiaryId: ctx.id,
        departmentId: dept.id,
        projectId: proj.id,
        ownerId,
        creatorId: ctx.ceoId,
        title: `${DEMO} ${t.title}`,
        status: t.status,
        priority: t.priority,
        dueDate: daysFromNow(t.dueDays),
        completedAt: t.status === "done" ? daysFromNow(t.dueDays) : null,
        isDemo: true,
      },
    });
    taskRows.push({ id: row.id, title: t.title, status: t.status, ownerId, dueDate: daysFromNow(t.dueDays), projectCode: t.project });
  }

  // A handful of personal tasks without projects (My Day content).
  const myDayTasks: { sub: string; title: string; status: string; dueDays: number; priority: string }[] = [
    { sub: "ascendium-energy", title: "Review September margin variance note", status: "todo", dueDays: 0, priority: "high" },
    { sub: "ascendium-energy", title: "Approve updated contractor HSE plan", status: "todo", dueDays: 1, priority: "medium" },
    { sub: "ascendium-academia", title: "Sign off semester 1 academic calendar", status: "in_progress", dueDays: 2, priority: "medium" },
    { sub: "ascendium-cyber-defence", title: "Complete annual security awareness training", status: "todo", dueDays: 5, priority: "low" },
  ];
  for (const t of myDayTasks) {
    const ctx = subs.get(t.sub)!;
    const deptId = [...ctx.departments.values()][0].id;
    const pool = employeeIdsBySub.get(ctx.id) ?? [];
    await prisma.task.create({
      data: {
        organisationId: org.id,
        subsidiaryId: ctx.id,
        departmentId: deptId,
        ownerId: pool[1] ?? ctx.ceoId,
        creatorId: ctx.ceoId,
        title: `${DEMO} ${t.title}`,
        status: t.status,
        priority: t.priority,
        dueDate: daysFromNow(t.dueDays),
        isDemo: true,
      },
    });
  }

  // ------------------------------------------------------------------
  // Decisions
  // ------------------------------------------------------------------
  const decisionDefs = [
    {
      title: "Helios Site B financing structure (debt vs equity mix)",
      sub: "ascendium-energy",
      status: "open",
      authority: "Group CEO with Group CFO recommendation",
      context: "Project Helios requires $52m of the $86m programme to be financed externally.",
      problem: "Choosing the capital structure for Site B determines group leverage and covenant headroom.",
      options: ["60/40 debt-equity via DFI facility", "100% equity hold", "JV with strategic energy partner"],
      evidence: "Group Treasury model v4 shows IRR sensitivity of ±240bps across the three structures.",
      financialImplication: "Up to $31.2m external debt; covenant leverage rises from 1.8x to 2.4x in the debt-heavy case.",
      riskAssessment: "Rate environment risk; mitigated by fixed-rate tranche option.",
      strategicAlignment: "Supports the group energy transition mandate and the 'enduring businesses' mission.",
      dependencies: "DFI term sheet expires in 12 days; EPC contract award for Site B pending.",
      recommendation: "Proceed with option 1 (60/40) including the fixed-rate tranche.",
      deadlineDays: 5,
    },
    {
      title: "Cyber Defence external client launch sequencing",
      sub: "ascendium-cyber-defence",
      status: "open",
      authority: "Group CEO",
      context: "Project Aegis reaches operational capability next quarter.",
      problem: "When and how to open the security operations capability to external clients without diluting internal protection.",
      options: ["Immediate launch to financial institutions", "6-month internal-only hardening", "Launch via partner channel"],
      evidence: "Market scan shows 14 institutions requesting managed defence proposals.",
      financialImplication: "Projected $6m ARR in year one under option 1.",
      riskAssessment: "Talent bandwidth is the binding constraint (3 unfilled analyst roles).",
      strategicAlignment: "Directly advances the AI Governance and Enterprise Intelligence solution families.",
      dependencies: "Hiring approvals APPR-2026-014/015; SOC certification audit.",
      recommendation: "Option 3 — partner channel first while hiring completes.",
      deadlineDays: 9,
    },
    {
      title: "DeepPort Berth 4 continuation decision",
      sub: "ascendium-oceanic-logistics",
      status: "open",
      authority: "Group Executive Committee",
      context: "The project has been on hold for five weeks pending the environmental permit resubmission.",
      problem: "Every month of delay costs an estimated $1.8m in standby and escalation.",
      options: ["Continue and resubmit permit", "Restructure as public-private consortium", "Write down and exit"],
      evidence: "Permit consultants assess 70% chance of approval within 90 days of resubmission.",
      financialImplication: "Continuation requires $14m incremental commitment this quarter.",
      riskAssessment: "Reputational exposure if the exit option becomes public.",
      strategicAlignment: "Infrastructure cluster anchors long-term logistics strategy.",
      dependencies: "Environmental counsel opinion due Friday; insurer notification.",
      recommendation: "Continue with the resubmission and begin consortium soundings in parallel.",
      deadlineDays: 7,
    },
    {
      title: "Adopt Ascendium One as the single institutional operating system",
      sub: "ascendium-digital-exchange",
      status: "approved",
      authority: "Group CEO",
      context: "Fragmentation across email, spreadsheets and drives is the group's most cited operational complaint.",
      problem: "Nineteen enterprises operating without one institutional source of truth.",
      options: ["Build Ascendium One", "Buy best-of-breed suite", "Status quo"],
      evidence: "Quarterly executive survey: 78% report weekly friction from fragmented systems.",
      financialImplication: "$14.2m programme cost over 18 months; projected 11% meeting-load reduction.",
      riskAssessment: "Adoption risk; mitigated by executive mandate and phased rollout.",
      strategicAlignment: "This is the operating embodiment of the AGH mission.",
      dependencies: "Project Atlas delivery; security accreditation from Group CIO.",
      recommendation: "Build Ascendium One.",
      rationale: "Approved. Nothing on the market carries our governance model. Build it. — LK",
      decidedDays: -21,
    },
    {
      title: "Group AI governance framework publication",
      sub: "ascendium-think-tank",
      status: "decided",
      authority: "Group Executive",
      context: "The framework underpins client offerings across all four solution families.",
      problem: "Publishing commits the group's reputation to a public standard.",
      options: ["Publish Q4", "Publish after three client pilots", "Keep internal"],
      evidence: "Two pilot institutions completed the Demonstrate stage with strong results.",
      financialImplication: "Positions an estimated $9m pipeline of governance engagements.",
      riskAssessment: "Framework must pass external peer review before publication.",
      strategicAlignment: "Core to the Decision Intelligence positioning.",
      dependencies: "Peer review panel confirmation; Legal sign-off.",
      recommendation: "Publish after three client pilots.",
      rationale: "Decided: align publication with the third pilot's Measure stage. — Group Executive Office",
      decidedDays: -6,
    },
    {
      title: "Think Tank — Pan-African Governance Institute merger study",
      sub: "ascendium-think-tank",
      status: "open",
      authority: "Group CEO",
      context: "Overlapping governance education mandates between the two knowledge-cluster institutions.",
      problem: "Potential duplication of programmes and donor relationships.",
      options: ["Full merger", "Shared services only", "Federation under one brand"],
      evidence: "Preliminary synergy analysis identifies $2.1m annual overlap.",
      financialImplication: "One-off integration cost estimated at $3.4m.",
      riskAssessment: "Talent flight risk among senior fellows if handled poorly.",
      strategicAlignment: "Strengthens the knowledge cluster's coherence.",
      dependencies: "Both CEOs' position papers due next week.",
      recommendation: "Federation under one brand, preserving both institutes' identities.",
      deadlineDays: 12,
    },
  ];

  const decisionRows: { id: string; title: string; status: string }[] = [];
  for (const d of decisionDefs) {
    const ctx = subs.get(d.sub)!;
    const row = await prisma.decision.create({
      data: {
        organisationId: org.id,
        subsidiaryId: ctx.id,
        ownerId: leonId,
        projectId: d.title.includes("Helios") ? projectRows.get("PRJ-HELIOS")!.id : d.title.includes("Ascendium One") ? projectRows.get("PRJ-ATLAS")!.id : null,
        title: `${DEMO} ${d.title}`,
        context: d.context,
        problem: d.problem,
        options: JSON.stringify(d.options),
        evidence: d.evidence,
        financialImplication: d.financialImplication,
        riskAssessment: d.riskAssessment,
        strategicAlignment: d.strategicAlignment,
        dependencies: d.dependencies,
        recommendation: d.recommendation,
        authority: d.authority,
        status: d.status,
        rationale: "rationale" in d ? d.rationale : null,
        decidedAt: "decidedDays" in d && d.decidedDays ? daysFromNow(d.decidedDays) : null,
        deadline: "deadlineDays" in d && d.deadlineDays ? daysFromNow(d.deadlineDays) : null,
        isDemo: true,
      },
    });
    decisionRows.push({ id: row.id, title: d.title, status: d.status });
  }

  // ------------------------------------------------------------------
  // Approvals (Leon Kayanda's "Your Decisions" inbox)
  // ------------------------------------------------------------------
  const approvalDefs = [
    {
      kind: "capital",
      title: "Helios Site B — $31.2m DFI debt facility",
      sub: "ascendium-energy",
      requesterRole: "cfo" as const,
      detail: "Approval to execute the 60/40 debt-equity structure for the Helios solar programme, Site B.",
      impact: 3_120_000_000,
      risk: "Raises group leverage to 2.4x; fixed-rate tranche mitigates rate risk.",
      evidence: "Group Treasury model v4; Decision record on file.",
      deadlineDays: 5,
    },
    {
      kind: "hiring",
      title: "Cyber Defence — 3 senior SOC analyst hires",
      sub: "ascendium-cyber-defence",
      requesterRole: "chro" as const,
      detail: "Approve headcount for the 24/7 security operations capability ahead of external launch.",
      impact: 486_000_00,
      risk: "Without these roles, the partner-channel launch slips one quarter.",
      evidence: "Project Aegis staffing plan v2.",
      deadlineDays: 8,
    },
    {
      kind: "contract",
      title: "EPC contract award — Helios Site B (Voltaris Consortium)",
      sub: "ascendium-energy",
      requesterRole: "coo" as const,
      detail: "Award of the engineering, procurement and construction contract for Site B to the preferred bidder.",
      impact: 8_400_000_000,
      risk: "Single-contractor concentration; mitigated by milestone-based payments and performance bonds.",
      evidence: "Tender evaluation report; legal review complete.",
      deadlineDays: 2,
    },
    {
      kind: "budget",
      title: "Academia — Semester 1 technology budget uplift",
      sub: "ascendium-academia",
      requesterRole: "cfo" as const,
      detail: "Additional learning-platform licences and lab infrastructure for the 5,000-learner target.",
      impact: 740_000_00,
      risk: "Low — within approved annual envelope.",
      evidence: "CFO variance note; vendor quotations (3).",
      deadlineDays: 11,
    },
    {
      kind: "strategic",
      title: "LifeScience — Metagenomics joint venture term sheet",
      sub: "ascendium-lifescience-biotech",
      requesterRole: "coo" as const,
      detail: "Approve the term sheet for a 50/50 JV with HelixBiotec for commercialisation of Programme Biome outputs.",
      impact: 5_000_000_000,
      risk: "IP ring-fencing must be watertight before signature.",
      evidence: "JV due diligence pack; General Counsel review in progress.",
      deadlineDays: 14,
    },
    {
      kind: "budget",
      title: "Think Tank — governance framework peer review panel",
      sub: "ascendium-think-tank",
      requesterRole: "chro" as const,
      detail: "Honoria for the external peer review panel ahead of framework publication.",
      impact: 96_000_00,
      risk: "Low.",
      evidence: "Panel composition memo.",
      deadlineDays: 6,
      status: "approved",
    },
  ];

  const requesterByRole: Record<string, string> = {
    cfo: groupExecIds[1],
    coo: groupExecIds[2],
    chro: groupExecIds[4],
  };

  for (const a of approvalDefs) {
    const ctx = subs.get(a.sub)!;
    await prisma.approval.create({
      data: {
        organisationId: org.id,
        subsidiaryId: ctx.id,
        requesterId: requesterByRole[a.requesterRole],
        approverId: leonId,
        kind: a.kind,
        title: `${DEMO} ${a.title}`,
        detail: a.detail,
        financialImpactCents: BigInt(a.impact),
        riskNote: a.risk,
        evidence: a.evidence,
        status: "status" in a ? a.status! : "pending",
        decidedAt: "status" in a ? daysFromNow(-2) : null,
        deadline: daysFromNow(a.deadlineDays),
        isDemo: true,
      },
    });
  }

  // ------------------------------------------------------------------
  // Risk register
  // ------------------------------------------------------------------
  const riskDefs = [
    { title: "Concentrated counterparty exposure in sovereign mandates", sub: "ascendium-sovereign-wealth-fund", category: "financial", p: 3, i: 5, status: "mitigating", esc: "board", mitigation: "Counterparty limits framework; quarterly rebalancing." },
    { title: "Helios permitting delay cascades into FY revenue", sub: "ascendium-energy", category: "operational", p: 4, i: 4, status: "mitigating", esc: "group", mitigation: "Parallel permitting track; weekly steering." },
    { title: "Cyber intrusion via third-party vendor credentials", sub: "ascendium-cyber-defence", category: "cyber", p: 3, i: 5, status: "mitigating", esc: "group", mitigation: "Vendor access reviews; zero-trust rollout (Project Aegis)." },
    { title: "Key-person dependency on founder-led client relationships", sub: "ascendium-consulting-investments", category: "strategic", p: 3, i: 4, status: "open", esc: "group", mitigation: "Relationship succession mapping; executive sponsorship model." },
    { title: "DeepPort environmental non-compliance findings", sub: "ascendium-oceanic-logistics", category: "compliance", p: 3, i: 4, status: "open", esc: "subsidiary", mitigation: "Environmental counsel oversight; permit resubmission." },
    { title: "Exchange v1 payments certification slippage", sub: "ascendium-digital-exchange", category: "operational", p: 4, i: 3, status: "mitigating", esc: "subsidiary", mitigation: "Daily certification standup; fallback provider engaged." },
    { title: "Regulatory change to cross-border education accreditation", sub: "ascendium-academia", category: "legal", p: 2, i: 4, status: "open", esc: "subsidiary", mitigation: "Dual-accreditation strategy; policy monitoring." },
    { title: "Fleet modernisation financing cost escalation", sub: "ascendium-transport", category: "financial", p: 3, i: 3, status: "mitigating", esc: "department", mitigation: "Rate-lock options; EXIM facility term sheet." },
    { title: "Clinical trial recruitment under-enrolment", sub: "ascendium-lifescience-biotech", category: "operational", p: 3, i: 4, status: "open", esc: "subsidiary", mitigation: "Multi-site expansion; recruitment partner." },
    { title: "AI governance framework reputational exposure on publication", sub: "ascendium-think-tank", category: "reputational", p: 2, i: 5, status: "mitigating", esc: "group", mitigation: "External peer review; staged publication with pilots." },
    { title: "Safety incident during Berth 4 construction restart", sub: "ascendium-oceanic-logistics", category: "safety", p: 2, i: 5, status: "accepted", esc: "subsidiary", mitigation: "Restart safety audit; insurer-mandated protocols." },
    { title: "Talent attrition in security engineering", sub: "ascendium-cyber-defence", category: "strategic", p: 4, i: 3, status: "mitigating", esc: "group", mitigation: "Retention grants; partner-channel hiring pipeline." },
  ];

  for (const r of riskDefs) {
    const ctx = subs.get(r.sub)!;
    await prisma.risk.create({
      data: {
        organisationId: org.id,
        subsidiaryId: ctx.id,
        ownerId: ctx.ceoId,
        projectId: r.title.includes("Helios") ? projectRows.get("PRJ-HELIOS")!.id : r.title.includes("certification") ? projectRows.get("PRJ-LEDGER")!.id : r.title.includes("vendor") ? projectRows.get("PRJ-AEGIS")!.id : null,
        title: `${DEMO} ${r.title}`,
        category: r.category,
        probability: r.p,
        impact: r.i,
        mitigation: r.mitigation,
        status: r.status,
        escalationLevel: r.esc,
        reviewDate: daysFromNow(intBetween(14, 60)),
        evidence: "Demo risk assessment record.",
        isDemo: true,
      },
    });
  }

  // ------------------------------------------------------------------
  // Documents & knowledge library
  // ------------------------------------------------------------------
  const docDefs = [
    {
      title: "Group AI Governance Policy",
      type: "policy",
      sub: "ascendium-think-tank",
      status: "published",
      tags: ["governance", "ai", "policy"],
      body: "Purpose: every AI system touching AGH data shall provide source attribution, human oversight, permission-aware retrieval, audit logging, confidence indicators and human approval for consequential actions. AI assists management; it does not silently make high-impact organisational decisions. Model and version changes are tracked in the AI registry. Sensitive data is classified before any AI processing. Exceptions require Group Risk Officer sign-off and expire within 90 days.",
    },
    {
      title: "Code of Institutional Conduct",
      type: "policy",
      sub: "ascendium-legal-group",
      status: "published",
      tags: ["conduct", "ethics"],
      body: "All officers and employees act as stewards of the institution. We disclose conflicts, protect entrusted information, compete fairly, and record the rationale for consequential decisions. Retaliation against good-faith escalation is prohibited. The standard is not merely compliance with law but conduct worthy of the trust placed in us.",
    },
    {
      title: "Risk Appetite Statement 2026",
      type: "policy",
      sub: "ascendium-capital-partners",
      status: "published",
      tags: ["risk", "capital"],
      body: "AGH accepts moderate strategic risk where the mission compels it, low tolerance for compliance and safety risk, and minimal tolerance for risks to institutional reputation. Group leverage ceiling: 2.5x net debt / EBITDA. Any breach requires Board notification within 48 hours.",
    },
    {
      title: "Information Security Policy",
      type: "policy",
      sub: "ascendium-cyber-defence",
      status: "published",
      tags: ["security"],
      body: "Defence in depth across identity, device, network and data. MFA is mandatory for all accounts. Least-privilege access with quarterly recertification. All security events are logged and reviewed by the Security Operations Centre. Incident classification follows the continuity matrix in Ascendium One.",
    },
    {
      title: "Helios EPC Tender Evaluation Report",
      type: "report",
      sub: "ascendium-energy",
      status: "in_review",
      tags: ["project", "procurement"],
      project: "PRJ-HELIOS",
      body: "Evaluation of three consortia against technical (40%), commercial (35%) and delivery (25%) criteria. Voltaris Consortium recommended at $8.4bn TCO with milestone-based payment structure and 10% performance bond. Two clarifications outstanding on grid interface warranties.",
    },
    {
      title: "Group Executive Meeting — September Minutes",
      type: "minutes",
      sub: "ascendium-consulting-investments",
      status: "published",
      tags: ["executive", "minutes"],
      body: "Standing items reviewed: group pulse, strategic execution index at 62, capital pipeline. Decisions: publication timing of the AI governance framework aligned to third pilot. Escalations: DeepPort permit resubmission date confirmed; hiring pipeline for SOC analysts to be accelerated. Actions: CFO to circulate Helios financing memo; COO to confirm EXIM term sheet.",
    },
    {
      title: "Board Briefing — Q3 Institutional Performance",
      type: "brief",
      sub: "ascendium-consulting-investments",
      status: "draft",
      tags: ["board", "briefing"],
      body: "Q3 narrative: revenue run-rate $731m against the $1.2bn annual objective; execution index improved 4 points; risk posture stable with two group-level escalations. Key judgement: sustain capital discipline while accelerating the energy and knowledge clusters.",
    },
    {
      title: "DFI Facility Term Sheet — Site B",
      type: "contract",
      sub: "ascendium-energy",
      status: "in_review",
      tags: ["finance", "contract"],
      body: "Proposed $31.2m senior debt facility, 12-year tenor, fixed-rate tranche option at 6.4%, covenant package per Group Treasury model v4. Conditions precedent include EPC award and grid interconnection approval.",
    },
  ];

  for (const d of docDefs) {
    const ctx = subs.get(d.sub)!;
    const dept = [...ctx.departments.values()][0];
    const row = await prisma.document.create({
      data: {
        organisationId: org.id,
        subsidiaryId: ctx.id,
        departmentId: dept.id,
        projectId: d.project ? projectRows.get(d.project)!.id : null,
        ownerId: ctx.ceoId,
        title: `${DEMO} ${d.title}`,
        docType: d.type,
        body: d.body,
        status: d.status,
        tags: JSON.stringify(d.tags),
        isDemo: true,
      },
    });
    await prisma.documentVersion.create({
      data: { documentId: row.id, version: 1, body: d.body, createdBy: ctx.ceoId },
    });
  }

  const knowledgeDefs = [
    { title: "Why AGH exists", tags: ["institutional-memory"], body: "Ascendium Global Holdings was founded in 2025 by Leon Kayanda on a single conviction: financial stewardship is a calling, and institutions should be measured by what they leave behind. The nineteen enterprises exist to solve global challenges across finance, knowledge, infrastructure, technology and frontier science." },
    { title: "The cluster logic", tags: ["institutional-memory"], body: "Five clusters organise capital and attention: Finance stewards capital, Knowledge stewards people and ideas, Infrastructure stewards hard assets, Technology stewards digital capability, Frontier stewards the long scientific horizon. Cross-cluster initiatives (e.g. ERPI) are where compound value is created." },
    { title: "The evidence journey", tags: ["methodology"], body: "Client engagements follow the published commercial journey: Discover, Diagnose, Demonstrate, Pilot, Measure, Deploy, Expand. Internal systems (VIM, AECS, AIOS, ELIAS, AILAT) are described at their actual maturity stage — never oversold." },
    { title: "Governance is designed in", tags: ["governance"], body: "Governance is not a bolt-on. It is designed into the architecture from the first diagnostic. Every consequential action in Ascendium One produces an audit record: who, what, when, where, previous value, new value, approval and reason." },
    { title: "Helios project context", tags: ["project", "energy"], body: "Project Helios is the flagship renewable programme: 120MW across two sites with a $86m budget. Site A is in construction; Site B awaits EPC award and grid interconnection approval. Financing decision pending with the Group CEO." },
  ];
  for (const k of knowledgeDefs) {
    await prisma.knowledgeItem.create({
      data: {
        organisationId: org.id,
        authorId: leonId,
        title: `${DEMO} ${k.title}`,
        body: k.body,
        tags: JSON.stringify(k.tags),
        isDemo: true,
      },
    });
  }

  // ------------------------------------------------------------------
  // Meetings
  // ------------------------------------------------------------------
  const execMeeting = await prisma.meeting.create({
    data: {
      organisationId: org.id,
      ownerId: leonId,
      title: `${DEMO} Group Executive Standup`,
      purpose: "Daily institutional pulse and escalation review.",
      startsAt: daysFromNow(0, 8),
      endsAt: daysFromNow(0, 8.5),
      location: "Ascendium One — Executive Room",
      agenda: "1. Group pulse\n2. Approvals inbox\n3. Escalations\n4. Strategic execution",
      notes: "Reviewed group pulse: execution index steady at 62. Two new group-level risks accepted into register. DeepPort decision date confirmed.",
      status: "scheduled",
      isDemo: true,
    },
  });
  for (const uid of groupExecIds) {
    await prisma.meetingAttendee.create({
      data: { meetingId: execMeeting.id, userId: uid, rsvp: "accepted" },
    });
  }
  const actionItems = [
    { body: "Circulate Helios financing memo to Group CEO", days: 1 },
    { body: "Confirm EXIM facility term sheet with Transport CFO", days: 2 },
    { body: "Board briefing pack final review", days: 3 },
  ];
  for (const a of actionItems) {
    await prisma.meetingActionItem.create({
      data: { meetingId: execMeeting.id, assigneeId: groupExecIds[1], body: `${DEMO} ${a.body}`, dueDate: daysFromNow(a.days) },
    });
  }

  const heliosReview = await prisma.meeting.create({
    data: {
      organisationId: org.id,
      subsidiaryId: subs.get("ascendium-energy")!.id,
      ownerId: subs.get("ascendium-energy")!.ceoId,
      title: `${DEMO} Helios Weekly Steering`,
      startsAt: daysFromNow(2, 14),
      endsAt: daysFromNow(2, 15),
      agenda: "1. EPC contract status\n2. Grid application\n3. Procurement lots\n4. Community engagement",
      status: "scheduled",
      isDemo: true,
    },
  });
  await prisma.meetingAttendee.create({ data: { meetingId: heliosReview.id, userId: subs.get("ascendium-energy")!.ceoId, rsvp: "accepted" } });
  await prisma.meetingActionItem.create({ data: { meetingId: heliosReview.id, body: `${DEMO} Resolve inverter supply blocker`, dueDate: daysFromNow(4) } });

  // ------------------------------------------------------------------
  // Communications
  // ------------------------------------------------------------------
  const channels = [
    { name: "general", kind: "group", topic: "Group-wide conversation" },
    { name: "executive", kind: "executive", topic: "C-Suite only" },
    { name: "energy-renewable-projects", kind: "team", topic: "Ascendium Energy → Renewable Projects", sub: "ascendium-energy" },
    { name: "project-atlas", kind: "team", topic: "Ascendium One build", sub: "ascendium-digital-exchange" },
  ];
  const channelIds: string[] = [];
  for (const c of channels) {
    const ch = await prisma.channel.create({
      data: {
        organisationId: org.id,
        name: c.name,
        kind: c.kind,
        topic: c.topic,
        subsidiaryId: c.sub ? subs.get(c.sub)!.id : null,
        isDemo: true,
      },
    });
    channelIds.push(ch.id);
  }
  const messageDefs = [
    { ch: 0, author: leonId, body: `${DEMO} Welcome to Ascendium One. One institution, one intelligence layer, one operating system. — Leon Kayanda, Founder & Group CEO` },
    { ch: 1, author: groupExecIds[1], body: `${DEMO} Helios financing memo is with the Group CEO for approval. Deadline this week.` },
    { ch: 1, author: groupExecIds[2], body: `${DEMO} DeepPort decision paper finalised. Recommending continuation with parallel consortium soundings.` },
    { ch: 2, author: subs.get("ascendium-energy")!.ceoId, body: `${DEMO} Grid application goes in Thursday. Procurement blocker on inverters needs APPR escalation.` },
    { ch: 3, author: groupExecIds[3], body: `${DEMO} RBAC sign-off complete. Next: migration dry-run with two subsidiaries.` },
  ];
  for (const m of messageDefs) {
    await prisma.message.create({
      data: {
        organisationId: org.id,
        channelId: channelIds[m.ch],
        authorId: m.author,
        body: m.body,
        isDemo: true,
      },
    });
  }

  // ------------------------------------------------------------------
  // Announcements
  // ------------------------------------------------------------------
  const announcementDefs = [
    { title: "Ascendium One is live", pinned: true, body: "Today we begin operating as one institution on one operating system. Nineteen enterprises, one source of institutional truth. — Leon Kayanda, Founder & Group CEO" },
    { title: "Q3 group performance review — Thursday 15:00", pinned: false, body: "All subsidiary CEOs and group executives to review the Q3 institutional performance pack in the Command Centre ahead of the session." },
    { title: "Security awareness month", pinned: false, body: "Annual security awareness training is open in My Learning. Completion is mandatory for all employees by end of month." },
    { title: "AI governance framework — publication update", pinned: false, body: "Following the second client pilot, framework publication is aligned to the third pilot's Measure stage. Peer review panel being convened." },
  ];
  for (const a of announcementDefs) {
    await prisma.announcement.create({
      data: {
        organisationId: org.id,
        authorId: leonId,
        title: `${DEMO} ${a.title}`,
        body: a.body,
        pinned: a.pinned,
        audience: "group",
        isDemo: true,
      },
    });
  }

  // ------------------------------------------------------------------
  // Notifications for the Group CEO (morning brief content)
  // ------------------------------------------------------------------
  const notifDefs = [
    { kind: "approval", severity: "important", title: "5 approvals await your decision", body: "Capital: Helios Site B financing ($31.2m). Contract: EPC award. Hiring: SOC analysts.", link: "/approvals" },
    { kind: "decision", severity: "important", title: "3 strategic decisions pending", body: "Helios financing structure; Cyber Defence launch sequencing; DeepPort continuation.", link: "/decisions" },
    { kind: "risk", severity: "critical", title: "Escalated risk: vendor credential intrusion", body: "Cyber Defence assesses material exposure if Project Aegis controls slip.", link: "/risks" },
    { kind: "risk", severity: "important", title: "2 emerging risks this week", body: "Exchange payments certification; sovereign counterparty concentration.", link: "/risks" },
    { kind: "task", severity: "info", title: "7 project updates across the group", body: "Atlas, Helios, Ledger, Aegis and more have status changes.", link: "/projects" },
    { kind: "announcement", severity: "info", title: "New group announcement", body: "Q3 group performance review scheduled for Thursday 15:00.", link: "/communications" },
  ];
  for (const n of notifDefs) {
    await prisma.notification.create({
      data: {
        organisationId: org.id,
        userId: leonId,
        kind: n.kind,
        severity: n.severity,
        title: `${DEMO} ${n.title}`,
        body: n.body,
        link: n.link,
        isDemo: true,
      },
    });
  }

  // ------------------------------------------------------------------
  // Incidents, issues, opportunities, workflows
  // ------------------------------------------------------------------
  await prisma.incident.create({
    data: {
      organisationId: org.id,
      subsidiaryId: subs.get("ascendium-cyber-defence")!.id,
      kind: "cybersecurity",
      title: `${DEMO} Phishing campaign targeting finance officers`,
      description: "Coordinated phishing wave detected across four subsidiaries. Containment active; no credential compromise confirmed.",
      severity: "high",
      status: "contained",
      responseTeam: JSON.stringify(["Kea Modise (Cyber Defence CEO)", "Adaeze Eze (Group CIO)", "Security Operations on-call"]),
      timeline: JSON.stringify([
        { at: daysFromNow(-1, 7).toISOString(), event: "Automated detection flagged campaign" },
        { at: daysFromNow(-1, 8).toISOString(), event: "Credentials reset pre-emptively for 41 users" },
        { at: daysFromNow(0, 6).toISOString(), event: "Contained — block rules deployed group-wide" },
      ]),
      isDemo: true,
    },
  });

  const issueDefs = [
    { sub: "ascendium-digital-exchange", title: "Payments gateway certification blocked", severity: "high", status: "escalated" },
    { sub: "ascendium-energy", title: "Inverter supply LOT 3 delayed", severity: "high", status: "assigned" },
    { sub: "ascendium-oceanic-logistics", title: "Berth 4 permit resubmission", severity: "critical", status: "investigating" },
    { sub: "ascendium-transport", title: "Telematics integration defects", severity: "medium", status: "reported" },
  ];
  for (const i of issueDefs) {
    const ctx = subs.get(i.sub)!;
    await prisma.issue.create({
      data: {
        organisationId: org.id,
        subsidiaryId: ctx.id,
        ownerId: ctx.ceoId,
        title: `${DEMO} ${i.title}`,
        severity: i.severity,
        status: i.status,
        isDemo: true,
      },
    });
  }

  const oppDefs = [
    { sub: "ascendium-consulting-investments", title: "Governance advisory mandate for a regional development bank", category: "business" },
    { sub: "ascendium-capital-partners", title: "Distressed infrastructure assets in the energy cluster", category: "investment" },
    { sub: "ascendium-academia", title: "Executive education partnership with a sovereign institution", category: "partnership" },
    { sub: "ascendium-energy", title: "Wheeling agreement unlocks 40MW additional revenue", category: "business" },
    { sub: "ascendium-transport", title: "Fleet telematics data monetisation", category: "venture" },
    { sub: "ascendium-cyber-defence", title: "Shared SOC services for knowledge-cluster institutions", category: "cost_saving" },
    { sub: "ascendium-think-tank", title: "Research collaboration on sovereign AI readiness", category: "research" },
  ];
  for (const o of oppDefs) {
    const ctx = subs.get(o.sub)!;
    await prisma.opportunity.create({
      data: {
        organisationId: org.id,
        subsidiaryId: ctx.id,
        ownerId: ctx.ceoId,
        title: `${DEMO} ${o.title}`,
        category: o.category,
        status: pick(["new", "evaluating", "pursuing"] as const),
        isDemo: true,
      },
    });
  }

  await prisma.workflow.create({
    data: {
      organisationId: org.id,
      name: `${DEMO} Standard executive approval chain`,
      description: "Request → manager → department head → subsidiary executive → group approval.",
      kind: "approval",
      definition: JSON.stringify([
        { name: "Manager review", order: 1 },
        { name: "Department head approval", order: 2 },
        { name: "Subsidiary executive approval", order: 3 },
        { name: "Group approval", order: 4 },
      ]),
    },
  });

  // Opening audit trail for the seed itself.
  await prisma.auditEvent.create({
    data: {
      organisationId: org.id,
      actorEmail: "system@ascendium.local",
      action: "system.seed",
      resourceType: "organisation",
      resourceId: org.id,
      newValue: JSON.stringify({ subsidiaries: SUBSIDIARIES.length, clusters: CLUSTERS.length, demoLabel: DEMO }),
      reason: "Initial organisation structure seeded from public source of truth.",
    },
  });

  const counts = {
    clusters: CLUSTERS.length,
    subsidiaries: SUBSIDIARIES.length,
    users: await prisma.user.count(),
    departments: await prisma.department.count(),
    projects: await prisma.project.count(),
    tasks: await prisma.task.count(),
    kpis: await prisma.kpi.count(),
    metrics: await prisma.metric.count(),
    risks: await prisma.risk.count(),
    decisions: await prisma.decision.count(),
    approvals: await prisma.approval.count(),
    documents: await prisma.document.count(),
  };
  console.log("[seed] complete:", JSON.stringify(counts, null, 2));
  console.log(`[seed] Group CEO login: leon.kayanda@ascendium.local / ${DEMO_PASSWORD} (all demo accounts share this password)`);
}

main()
  .catch((e) => {
    console.error("[seed] failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
