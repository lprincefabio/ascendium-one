// Domain constants — string unions enforced at the application layer
// (SQLite has no native enums; these are the single source of truth).

export const PERMISSION_LEVELS = ["own", "department", "subsidiary", "group"] as const;
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

export const LEVEL_RANK: Record<PermissionLevel, number> = {
  own: 1,
  department: 2,
  subsidiary: 3,
  group: 4,
};

export const RESOURCES = [
  "task",
  "project",
  "kpi",
  "decision",
  "risk",
  "document",
  "knowledge",
  "meeting",
  "announcement",
  "approval",
  "people",
  "subsidiary",
  "department",
  "finance",
  "strategy",
  "admin",
  "audit",
  "ai",
  "search",
  "workflow",
  "incident",
  "opportunity",
  "issue",
  "message",
  "notification",
] as const;
export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = [
  "read",
  "create",
  "update",
  "delete",
  "approve",
  "administer",
] as const;
export type Action = (typeof ACTIONS)[number];

export type Permission = `${Resource}:${Action}:${PermissionLevel}`;

export const TASK_STATUSES = ["todo", "in_progress", "blocked", "review", "done", "cancelled"] as const;
export const PROJECT_STATUSES = ["planning", "active", "on_hold", "completed", "cancelled"] as const;
export const PROJECT_HEALTHS = ["green", "amber", "red"] as const;
export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const DECISION_STATUSES = ["open", "decided", "approved", "rejected", "superseded"] as const;
export const RISK_STATUSES = ["open", "mitigating", "accepted", "closed"] as const;
export const RISK_CATEGORIES = [
  "financial",
  "operational",
  "strategic",
  "compliance",
  "cyber",
  "legal",
  "reputational",
  "safety",
] as const;
export const KPI_CATEGORIES = [
  "financial",
  "operational",
  "strategic",
  "customer",
  "employee",
  "project",
  "learning",
  "compliance",
  "sustainability",
] as const;
export const OBJECTIVE_LEVELS = ["group", "cluster", "subsidiary", "department", "individual"] as const;
export const OBJECTIVE_STATUSES = ["on_track", "at_risk", "off_track", "achieved", "paused"] as const;
export const DOCUMENT_TYPES = ["policy", "contract", "report", "presentation", "note", "minutes", "brief"] as const;
export const APPROVAL_KINDS = [
  "budget",
  "hiring",
  "procurement",
  "contract",
  "strategic",
  "project",
  "policy",
  "capital",
  "risk_acceptance",
] as const;
export const NOTIFICATION_SEVERITIES = ["critical", "important", "info"] as const;

export const ROLE_CODES = [
  "GROUP_CEO",
  "GROUP_EXECUTIVE",
  "BOARD_MEMBER",
  "GROUP_CFO",
  "GROUP_COO",
  "GROUP_CIO",
  "GROUP_CHRO",
  "GROUP_GENERAL_COUNSEL",
  "GROUP_RISK_OFFICER",
  "GROUP_COMPLIANCE_OFFICER",
  "SUBSIDIARY_CEO",
  "MANAGING_DIRECTOR",
  "CFO",
  "COO",
  "DEPARTMENT_HEAD",
  "MANAGER",
  "EMPLOYEE",
  "SYSTEM_ADMINISTRATOR",
  "SECURITY_ADMINISTRATOR",
  "DATA_ADMINISTRATOR",
] as const;

export function parsePermissions(json: string): Permission[] {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.filter((p): p is Permission => typeof p === "string" && p.split(":").length === 3);
  } catch {
    return [];
  }
}
