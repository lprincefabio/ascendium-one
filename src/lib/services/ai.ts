import { prisma } from "@/lib/db";
import { permissionLevelFor, type SessionUser } from "@/lib/auth";
import { peopleScopeWhere } from "@/lib/rbac";
import { LEVEL_RANK } from "@/lib/domain";
import { universalSearch } from "@/lib/services/search";
import { formatCompactMoney } from "@/lib/format";

export type AskResponse = {
  answer: string;
  citations: { label: string; href: string }[];
  confidence: "high" | "medium" | "low";
  provider: string;
};

type Citation = { label: string; href: string };
type Ctx = { orgId: string; scope: Record<string, unknown>; user: SessionUser };

const has = (user: SessionUser, resource: string) => permissionLevelFor(user, resource, "read") !== null;
const demoNote = (rows: { isDemo: boolean }[]) => (rows.some((r) => r.isDemo) ? "\n\nNote: this answer is derived from labelled demonstration data." : "");

function subScope(user: SessionUser, resource: string): Record<string, unknown> {
  const l = permissionLevelFor(user, resource, "read");
  if (!l || LEVEL_RANK[l] >= LEVEL_RANK.group || !user.subsidiaryId) return {};
  return { OR: [{ subsidiaryId: user.subsidiaryId }, { subsidiaryId: null }] };
}

async function intentProjects(ctx: Ctx, question: string): Promise<{ text: string; citations: Citation[]; confidence: AskResponse["confidence"] } | null> {
  const delayed = /delay|behind|late|at risk|blocked|slippage/i.test(question);
  const rows = await prisma.project.findMany({
    where: { organisationId: ctx.orgId, ...ctx.scope, ...(delayed ? { OR: [{ health: "red" }, { health: "amber" }, { status: "on_hold" }] } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 8,
    include: { subsidiary: { select: { name: true } } },
  });
  if (rows.length === 0) return { text: "No projects match your question within your scope.", citations: [], confidence: "high" };
  const lines = rows.map((p) => {
    const pct = p.budgetCents > 0 ? Math.round(Number((p.spentCents * 100n) / p.budgetCents)) : 0;
    return `• ${p.name}${p.code ? ` (${p.code})` : ""} — ${p.subsidiary?.name ?? "Ascendium Global Holdings"}: ${p.status}, health ${p.health}, ${pct}% of budget spent.`;
  });
  const text = delayed
    ? `Projects currently delayed or at risk within your scope (${rows.length}):\n${lines.join("\n")}`
    : `Projects within your scope (${rows.length}):\n${lines.join("\n")}`;
  return {
    text: text + demoNote(rows),
    citations: rows.slice(0, 4).map((p) => ({ label: p.code ?? p.name, href: `/projects/${p.id}` })),
    confidence: "high",
  };
}

async function intentRisks(ctx: Ctx): Promise<{ text: string; citations: Citation[]; confidence: AskResponse["confidence"] } | null> {
  const rows = await prisma.risk.findMany({
    where: { organisationId: ctx.orgId, ...ctx.scope, status: { in: ["open", "mitigating"] } },
    orderBy: [{ probability: "desc" }, { impact: "desc" }],
    take: 8,
    include: { subsidiary: { select: { name: true } } },
  });
  if (rows.length === 0) return { text: "No open risks in your scope.", citations: [], confidence: "high" };
  const lines = rows.map((r) => `• ${r.title} — ${r.subsidiary?.name ?? "Ascendium Global Holdings"}: probability ${r.probability}/5, impact ${r.impact}/5, status ${r.status}.`);
  return {
    text: `Open risks in your scope (${rows.length}), highest exposure first:\n${lines.join("\n")}` + demoNote(rows),
    citations: rows.slice(0, 4).map(() => ({ label: "Risk register", href: "/risks" })),
    confidence: "high",
  };
}

async function intentDecisions(ctx: Ctx): Promise<{ text: string; citations: Citation[]; confidence: AskResponse["confidence"] } | null> {
  const rows = await prisma.decision.findMany({
    where: { organisationId: ctx.orgId, ...ctx.scope, status: "open" },
    orderBy: { deadline: "asc" },
    take: 8,
    include: { owner: { select: { firstName: true, lastName: true } } },
  });
  if (rows.length === 0) return { text: "No unresolved decisions in your scope.", citations: [], confidence: "high" };
  const lines = rows.map((d) => `• ${d.title} — owner ${d.owner ? `${d.owner.firstName} ${d.owner.lastName}` : "unassigned"}, due ${d.deadline ? d.deadline.toISOString().slice(0, 10) : "unspecified"}.`);
  return {
    text: `Unresolved decisions awaiting resolution (${rows.length}), by deadline:\n${lines.join("\n")}` + demoNote(rows),
    citations: rows.slice(0, 4).map(() => ({ label: "Decision Room", href: "/decisions" })),
    confidence: "high",
  };
}

async function intentTasks(ctx: Ctx, user: SessionUser, question: string): Promise<{ text: string; citations: Citation[]; confidence: AskResponse["confidence"] } | null> {
  const ownOnly = /\bmy\b|mine|assigned to me/i.test(question);
  const where = ownOnly
    ? { organisationId: ctx.orgId, ownerId: user.id, status: { in: ["todo", "in_progress", "blocked", "review"] } }
    : { organisationId: ctx.orgId, ...ctx.scope, status: { in: ["todo", "in_progress", "blocked", "review"] } };
  const rows = await prisma.task.findMany({ where, orderBy: { dueDate: "asc" }, take: 10, include: { owner: { select: { firstName: true, lastName: true } } } });
  if (rows.length === 0) return { text: ownOnly ? "You have no open tasks." : "No open tasks in your scope.", citations: [], confidence: "high" };
  const now = Date.now();
  const lines = rows.map((t) => {
    const late = t.dueDate && t.dueDate.getTime() < now ? " — OVERDUE" : "";
    return `• ${t.title} — ${t.owner ? `${t.owner.firstName} ${t.owner.lastName}` : "Unassigned"}, ${t.priority} priority, due ${t.dueDate ? t.dueDate.toISOString().slice(0, 10) : "—"}${late}`;
  });
  return {
    text: `Open tasks${ownOnly ? " assigned to you" : " in your scope"} (${rows.length}), by deadline:\n${lines.join("\n")}` + demoNote(rows),
    citations: [{ label: "Tasks", href: "/tasks" }],
    confidence: "high",
  };
}

async function intentKpis(ctx: Ctx): Promise<{ text: string; citations: Citation[]; confidence: AskResponse["confidence"] } | null> {
  const kpis = await prisma.kpi.findMany({
    where: { organisationId: ctx.orgId, ...ctx.scope },
    include: { values: { orderBy: { period: "desc" }, take: 3 } },
    take: 8,
  });
  if (kpis.length === 0) return { text: "No KPIs visible in your scope.", citations: [], confidence: "high" };
  const lines = kpis.map((k) => {
    const latest = k.values[0];
    const prev = k.values[1];
    const delta = latest && prev ? (latest.value - prev.value > 0 ? "▲" : latest.value - prev.value < 0 ? "▼" : "→") : "";
    return `• ${k.name} (${k.unit}): ${latest ? `${latest.value}${latest.target != null ? ` vs target ${latest.target}` : ""} ${delta}`.trim() : "no data yet"}.`;
  });
  return {
    text: `Latest KPI readings in your scope:\n${lines.join("\n")}` + demoNote(kpis),
    citations: [{ label: "KPI engine", href: "/kpis" }],
    confidence: "high",
  };
}

async function intentApprovals(ctx: Ctx, user: SessionUser): Promise<{ text: string; citations: Citation[]; confidence: AskResponse["confidence"] } | null> {
  const rows = await prisma.approval.findMany({
    where: { organisationId: ctx.orgId, ...ctx.scope, status: "pending", approverId: user.id },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  if (rows.length === 0) return { text: "You have no approvals awaiting your decision.", citations: [], confidence: "high" };
  const lines = rows.map((a) => `• ${a.title} (${a.kind}): ${a.detail ?? ""} Financial impact ${a.financialImpactCents != null ? formatCompactMoney(a.financialImpactCents) : "not stated"}.`);
  return {
    text: `Approvals awaiting your decision (${rows.length}):\n${lines.join("\n")}` + demoNote(rows),
    citations: [{ label: "Your Decisions inbox", href: "/approvals" }],
    confidence: "high",
  };
}

async function intentPeople(ctx: Ctx, question: string): Promise<{ text: string; citations: Citation[]; confidence: AskResponse["confidence"] } | null> {
  if (!has(ctx.user, "people")) return null;
  const name = question.replace(/who is|who heads|leadership|head of|tell me about|director of/gi, "").trim();
  const rows = await prisma.user.findMany({
    where: {
      ...peopleScopeWhere(ctx.user),
      AND: name.length > 2 ? [{ OR: [{ firstName: { contains: name } }, { lastName: { contains: name } }, { title: { contains: name } }] }] : [],
    },
    include: { subsidiary: { select: { name: true } }, department: { select: { name: true } }, role: { select: { name: true } } },
    take: 5,
  });
  if (rows.length === 0) return { text: "No people matched within your directory permissions.", citations: [], confidence: "high" };
  const lines = rows.map((u) => `• ${u.firstName} ${u.lastName} — ${u.title ?? "—"} at ${u.subsidiary?.name ?? "Ascendium Global Holdings"}${u.department ? `, ${u.department.name}` : ""} (${u.role?.name ?? "no role"}).`);
  return {
    text: lines.join("\n") + demoNote(rows),
    citations: rows.slice(0, 3).map((u) => ({ label: `${u.firstName} ${u.lastName}`, href: `/directory?focus=${u.id}` })),
    confidence: "high",
  };
}

async function intentOrgSummary(ctx: Ctx): Promise<{ text: string; citations: Citation[]; confidence: AskResponse["confidence"] }> {
  const [subs, clusters, projects, people] = await Promise.all([
    prisma.subsidiary.count({ where: { organisationId: ctx.orgId } }),
    prisma.cluster.count({ where: { organisationId: ctx.orgId } }),
    prisma.project.count({ where: { organisationId: ctx.orgId, ...ctx.scope } }),
    prisma.user.count({ where: { organisationId: ctx.orgId, isActive: true } }),
  ]);
  const ceo = await prisma.user.findFirst({
    where: { organisationId: ctx.orgId, title: { contains: "Group CEO" } },
  });
  return {
    text:
      `Ascendium Global Holdings operates ${subs} enterprises across ${clusters} clusters — Finance, Knowledge, Infrastructure, Technology and Frontier — ` +
      `with ${people} active people on this platform and ${projects} projects visible in your scope.` +
      (ceo ? ` The group is founded and led by ${ceo.firstName} ${ceo.lastName}, Founder & Group CEO.` : ""),
    citations: [
      { label: "Ascendium Map", href: "/org-map" },
      { label: "Subsidiaries", href: "/subsidiaries" },
    ],
    confidence: "high",
  };
}

/** Local deterministic engine: intent classification + scoped retrieval + templated synthesis. */
async function answerLocal(user: SessionUser, question: string): Promise<AskResponse> {
  const q = question.toLowerCase();
  const orgId = user.organisationId;
  const scope = { OR: [{ subsidiaryId: null }, ...(user.subsidiaryId ? [{ subsidiaryId: user.subsidiaryId }] : [])] };

  let result: { text: string; citations: Citation[]; confidence: AskResponse["confidence"] } | null = null;

  if (/who is|who heads|leadership|head of|tell me about/i.test(q) && has(user, "people")) {
    result = await intentPeople({ orgId, scope, user }, q);
  } else if (/risk/i.test(q) && has(user, "risk")) {
    result = await intentRisks({ orgId, scope: subScope(user, "risk"), user });
  } else if (/decision/i.test(q) && has(user, "decision")) {
    result = await intentDecisions({ orgId, scope: subScope(user, "decision"), user });
  } else if (/approval|awaiting your|sign off|sign-off/i.test(q) && has(user, "approval")) {
    result = await intentApprovals({ orgId, scope: subScope(user, "approval"), user }, user);
  } else if (/task|overdue|to.?do|deadline|priority/i.test(q) && has(user, "task")) {
    result = await intentTasks({ orgId, scope: subScope(user, "task"), user }, user, q);
  } else if (/kpi|metric|performance|revenue|margin|how are we doing/i.test(q) && has(user, "kpi")) {
    result = await intentKpis({ orgId, scope: subScope(user, "kpi"), user });
  } else if (/project|delay|at risk|portfolio/i.test(q) && has(user, "project")) {
    result = await intentProjects({ orgId, scope: subScope(user, "project"), user }, q);
  } else if (/subsidiar|cluster|organisation|organization|ecosystem|how many/i.test(q) && has(user, "subsidiary")) {
    result = await intentOrgSummary({ orgId, scope, user });
  }

  if (!result) {
    // Fallback: universal search retrieval, then transparent "here is what I found".
    const hits = await universalSearch(user, question, 6);
    if (hits.length === 0) {
      return {
        answer: "I could not find anything relevant within your permissions. Try naming a project, person, subsidiary, KPI or decision.",
        citations: [],
        confidence: "low",
        provider: "ascendium-local-v1",
      };
    }
    return {
      answer: `I could not match a specific analytical intent, but here is what I found in the institutional record:\n${hits.map((h) => `• [${h.type}] ${h.title}${h.subtitle ? ` — ${h.subtitle}` : ""}`).join("\n")}`,
      citations: hits.slice(0, 5).map((h) => ({ label: h.title, href: h.href })),
      confidence: "low",
      provider: "ascendium-local-v1",
    };
  }

  return { answer: result.text, citations: result.citations, confidence: result.confidence, provider: "ascendium-local-v1" };
}

/**
 * Provider abstraction: when AI_PROVIDER/AI_API_KEY are configured the same
 * retrieved context is sent to the external model (RAG); otherwise the local
 * deterministic engine answers. Ascendium Intelligence always records an
 * audit interaction either way.
 */
export async function answerQuestion(user: SessionUser, question: string): Promise<AskResponse> {
  const started = Date.now();
  const provider = process.env.AI_PROVIDER ?? "local";

  let response: AskResponse;
  let intent: string | null = null;

  if (provider !== "local" && process.env.AI_API_KEY) {
    // RAG over the permission-scoped index, then external synthesis.
    const hits = await universalSearch(user, question, 8);
    const context = hits.map((h) => `- [${h.type}] ${h.title}${h.subtitle ? ` — ${h.subtitle}` : ""}`).join("\n");
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` },
        body: JSON.stringify({
          model: process.env.AI_MODEL ?? "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are Ascendium Intelligence, the enterprise assistant of Ascendium Global Holdings. Answer only from the provided institutional context. Distinguish facts from recommendations, never present assumptions as facts, and say when information is absent." },
            { role: "user", content: `Context (permission-scoped):\n${context}\n\nQuestion: ${question}` },
          ],
          temperature: 0.2,
        }),
      });
      if (!res.ok) throw new Error(`provider ${res.status}`);
      const json = await res.json();
      const text = json.choices?.[0]?.message?.content ?? "";
      response = {
        answer: text || "The provider returned an empty response.",
        citations: hits.slice(0, 5).map((h) => ({ label: h.title, href: h.href })),
        confidence: hits.length > 0 ? "medium" : "low",
        provider: `${provider}/${process.env.AI_MODEL ?? "default"}`,
      };
    } catch {
      response = await answerLocal(user, question);
    }
  } else {
    response = await answerLocal(user, question);
    intent = response.confidence === "low" ? "retrieval_fallback" : "classified";
  }

  await prisma.aIInteraction.create({
    data: {
      organisationId: user.organisationId,
      userId: user.id,
      prompt: question.slice(0, 4000),
      response: response.answer.slice(0, 8000),
      intent,
      sources: JSON.stringify(response.citations),
      confidence: response.confidence,
      model: "ascendium-retrieval-v1",
      provider: response.provider,
      latencyMs: Date.now() - started,
    },
  });

  return response;
}
