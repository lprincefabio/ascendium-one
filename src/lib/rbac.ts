import type { Prisma } from "@prisma/client";
import { permissionLevelFor, type SessionUser } from "@/lib/auth";
import { LEVEL_RANK, type PermissionLevel, type Resource, type Action } from "@/lib/domain";

export class ForbiddenError extends Error {
  status = 403;
  digest = "FORBIDDEN";
  constructor(message = "You do not have permission to perform this action") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function can(user: SessionUser, resource: Resource, action: Action): boolean {
  return permissionLevelFor(user, resource, action) !== null;
}

export function assertCan(user: SessionUser, resource: Resource, action: Action): PermissionLevel {
  const level = permissionLevelFor(user, resource, action);
  if (!level) throw new ForbiddenError();
  return level;
}

/**
 * Per-resource scoping facts, matched to the actual Prisma model fields.
 * `sub`/`dept` name the subsidiary/department foreign keys on the model
 * (absent when the model has none); `own` builds the ownership fragment for
 * "own"-level reads (e.g. Project has no ownerId — membership lives on
 * ProjectMember, and Approval is owned via requesterId/approverId).
 */
type ScopeFields = {
  sub?: string;
  dept?: string;
  own: (userId: string) => Record<string, unknown>;
};

const SCOPE_FIELDS: Partial<Record<Resource, ScopeFields>> = {
  task: { sub: "subsidiaryId", dept: "departmentId", own: (id) => ({ ownerId: id }) },
  project: { sub: "subsidiaryId", dept: "departmentId", own: (id) => ({ members: { some: { userId: id } } }) },
  kpi: { sub: "subsidiaryId", dept: "departmentId", own: (id) => ({ ownerId: id }) },
  decision: { sub: "subsidiaryId", dept: "departmentId", own: (id) => ({ ownerId: id }) },
  risk: { sub: "subsidiaryId", dept: "departmentId", own: (id) => ({ ownerId: id }) },
  document: { sub: "subsidiaryId", dept: "departmentId", own: (id) => ({ ownerId: id }) },
  meeting: { sub: "subsidiaryId", dept: "departmentId", own: (id) => ({ ownerId: id }) },
  approval: { sub: "subsidiaryId", own: (id) => ({ OR: [{ requesterId: id }, { approverId: id }] }) },
  opportunity: { sub: "subsidiaryId", own: (id) => ({ ownerId: id }) },
  incident: { sub: "subsidiaryId", own: () => ({}) },
};

/**
 * Builds a Prisma `where` fragment restricting a query to the user's
 * authorised organisational scope. The organisation id is always applied by
 * callers; this adds subsidiary/department/own boundaries.
 *
 * `ownFields` names the field(s) that constitute "own" ownership for
 * resources without a SCOPE_FIELDS entry.
 */
export function scopeWhere(
  user: SessionUser,
  resource: Resource,
  action: Action = "read",
  ownFields: string[] = ["ownerId"]
): Prisma.InputJsonValue | Record<string, unknown> {
  const level = permissionLevelFor(user, resource, action);
  if (!level) throw new ForbiddenError();

  const f: ScopeFields = SCOPE_FIELDS[resource] ?? {
    sub: "subsidiaryId",
    dept: "departmentId",
    own: (id) => ({ OR: ownFields.map((x) => ({ [x]: id })) }),
  };

  if (LEVEL_RANK[level] >= LEVEL_RANK.group) return {};
  if (f.sub && LEVEL_RANK[level] >= LEVEL_RANK.subsidiary && user.subsidiaryId) {
    return { [f.sub]: user.subsidiaryId };
  }
  const own = f.own(user.id);
  if (LEVEL_RANK[level] >= LEVEL_RANK.department && user.departmentId) {
    if (f.dept) return { OR: [{ [f.dept]: user.departmentId }, own] };
    // No department key on the model: give department-level readers their
    // subsidiary's rows plus unassigned (group-level) rows.
    if (f.sub && user.subsidiaryId) return { OR: [{ [f.sub]: user.subsidiaryId }, { [f.sub]: null }] };
  }
  return own;
}

/** Restricts people-directory visibility. */
export function peopleScopeWhere(user: SessionUser): Record<string, unknown> {
  const level = permissionLevelFor(user, "people", "read");
  if (!level) throw new ForbiddenError();
  if (LEVEL_RANK[level] >= LEVEL_RANK.group) return {};
  if (LEVEL_RANK[level] >= LEVEL_RANK.subsidiary && user.subsidiaryId) {
    return { subsidiaryId: user.subsidiaryId };
  }
  if (LEVEL_RANK[level] >= LEVEL_RANK.department && user.departmentId) {
    return { OR: [{ departmentId: user.departmentId }, { id: user.id }] };
  }
  return { id: user.id };
}
