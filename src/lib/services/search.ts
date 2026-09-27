import { prisma } from "@/lib/db";
import { permissionLevelFor, type SessionUser } from "@/lib/auth";
import { peopleScopeWhere } from "@/lib/rbac";
import { LEVEL_RANK, type PermissionLevel } from "@/lib/domain";

export type SearchResult = {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  href: string;
  isDemo: boolean;
  score: number;
};

function level(user: SessionUser, resource: string): PermissionLevel | null {
  return permissionLevelFor(user, resource, "read");
}

/**
 * Universal, permission-aware search. Every entity family is only queried when
 * the caller holds read permission, and subsidiary-scoped users never see
 * rows outside their subsidiary.
 */
export async function universalSearch(user: SessionUser, query: string, limit = 8): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const contains = { contains: q };
  const org = { organisationId: user.organisationId };
  const results: SearchResult[] = [];

  const lvl = (r: string) => {
    const l = level(user, r);
    return l ? LEVEL_RANK[l] : 0;
  };
  const subScope = (r: string) => {
    const l = level(user, r);
    if (!l) return null;
    if (LEVEL_RANK[l] >= LEVEL_RANK.group || !user.subsidiaryId) return {};
    return { OR: [{ subsidiaryId: user.subsidiaryId }, { subsidiaryId: null }] };
  };

  if (lvl("project") > 0) {
    const rows = await prisma.project.findMany({
      where: { ...org, ...subScope("project")!, AND: [{ OR: [{ name: contains }, { code: contains }, { description: contains }] }] },
      take: limit,
    });
    for (const r of rows) results.push({ id: r.id, type: "project", title: r.name, subtitle: r.code, href: `/projects/${r.id}`, isDemo: r.isDemo, score: 3 });
  }

  if (lvl("task") > 0) {
    const scope = subScope("task")!;
    const rows = await prisma.task.findMany({
      where: { ...org, ...scope, AND: [{ OR: [{ title: contains }, { description: contains }] }] },
      take: limit,
    });
    for (const r of rows) results.push({ id: r.id, type: "task", title: r.title, subtitle: null, href: "/tasks", isDemo: r.isDemo, score: 2 });
  }

  if (lvl("decision") > 0) {
    const rows = await prisma.decision.findMany({
      where: { ...org, ...subScope("decision")!, AND: [{ OR: [{ title: contains }, { problem: contains }, { context: contains }] }] },
      take: limit,
    });
    for (const r of rows) results.push({ id: r.id, type: "decision", title: r.title, subtitle: r.status, href: "/decisions", isDemo: r.isDemo, score: 3 });
  }

  if (lvl("risk") > 0) {
    const rows = await prisma.risk.findMany({
      where: { ...org, ...subScope("risk")!, title: contains },
      take: limit,
    });
    for (const r of rows) results.push({ id: r.id, type: "risk", title: r.title, subtitle: `P${r.probability} × I${r.impact}`, href: "/risks", isDemo: r.isDemo, score: 3 });
  }

  if (lvl("document") > 0) {
    const rows = await prisma.document.findMany({
      where: { ...org, ...subScope("document")!, AND: [{ OR: [{ title: contains }, { body: contains }] }] },
      take: limit,
    });
    for (const r of rows) results.push({ id: r.id, type: "document", title: r.title, subtitle: r.docType, href: "/documents", isDemo: r.isDemo, score: 3 });
  }

  if (lvl("knowledge") > 0) {
    const rows = await prisma.knowledgeItem.findMany({
      where: { ...org, AND: [{ OR: [{ title: contains }, { body: contains }] }] },
      take: limit,
    });
    for (const r of rows) results.push({ id: r.id, type: "knowledge", title: r.title, subtitle: null, href: "/documents", isDemo: r.isDemo, score: 2 });
  }

  if (lvl("subsidiary") > 0) {
    const rows = await prisma.subsidiary.findMany({ where: { ...org, name: contains }, take: limit });
    for (const r of rows) results.push({ id: r.id, type: "subsidiary", title: r.name, subtitle: r.sector, href: `/subsidiaries/${r.slug}`, isDemo: r.isDemo, score: 4 });
  }

  if (lvl("kpi") > 0) {
    const rows = await prisma.kpi.findMany({
      where: { ...org, ...subScope("kpi")!, name: contains },
      take: limit,
    });
    for (const r of rows) results.push({ id: r.id, type: "kpi", title: r.name, subtitle: r.category, href: "/kpis", isDemo: r.isDemo, score: 2 });
  }

  if (lvl("people") > 0) {
    const rows = await prisma.user.findMany({
      where: { ...peopleScopeWhere(user), AND: [{ OR: [{ firstName: contains }, { lastName: contains }, { title: contains }] }] },
      take: limit,
    });
    for (const r of rows) results.push({ id: r.id, type: "person", title: `${r.firstName} ${r.lastName}`, subtitle: r.title, href: `/directory?focus=${r.id}`, isDemo: r.isDemo, score: 4 });
  }

  if (lvl("announcement") > 0) {
    const rows = await prisma.announcement.findMany({ where: { ...org, title: contains }, take: limit });
    for (const r of rows) results.push({ id: r.id, type: "announcement", title: r.title, subtitle: null, href: "/announcements", isDemo: r.isDemo, score: 1 });
  }

  if (lvl("issue") > 0) {
    const rows = await prisma.issue.findMany({ where: { ...org, ...subScope("issue")!, title: contains }, take: limit });
    for (const r of rows) results.push({ id: r.id, type: "issue", title: r.title, subtitle: r.severity, href: "/issues", isDemo: r.isDemo, score: 2 });
  }

  if (lvl("opportunity") > 0) {
    const rows = await prisma.opportunity.findMany({ where: { ...org, ...subScope("opportunity")!, title: contains }, take: limit });
    for (const r of rows) results.push({ id: r.id, type: "opportunity", title: r.title, subtitle: r.category, href: "/opportunities", isDemo: r.isDemo, score: 2 });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit * 2);
}
