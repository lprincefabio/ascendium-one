import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { permissionLevelFor, type SessionUser } from "@/lib/auth";
import type { Permission } from "@/lib/domain";
import { can, assertCan, ForbiddenError, scopeWhere, peopleScopeWhere } from "@/lib/rbac";

function makeUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "user-1",
    organisationId: "org-1",
    email: "user@ascendium.local",
    firstName: "Test",
    lastName: "User",
    title: null,
    subsidiaryId: "sub-1",
    departmentId: "dept-1",
    managerId: null,
    isExecutive: false,
    isAdmin: false,
    avatarHue: 200,
    role: null,
    ...overrides,
  };
}

function withRole(code: string, level: string, permissions: string[]): SessionUser {
  return makeUser({ role: { code, name: code, level, permissions: permissions as Permission[] } });
}

describe("permissionLevelFor", () => {
  it("grants group level to admins regardless of role permissions", () => {
    const user = makeUser({ isAdmin: true, role: { code: "EMPLOYEE", name: "Employee", level: "own", permissions: ["task:read:own"] } });
    expect(permissionLevelFor(user, "risk", "read")).toBe("group");
  });

  it("returns null when the user has no role", () => {
    expect(permissionLevelFor(makeUser(), "task", "read")).toBeNull();
  });

  it("returns null when no permission matches the resource+action", () => {
    const user = withRole("EMPLOYEE", "own", ["task:read:own"]);
    expect(permissionLevelFor(user, "risk", "read")).toBeNull();
    expect(permissionLevelFor(user, "task", "delete")).toBeNull();
  });

  it("returns the highest level among multiple matching grants", () => {
    const user = withRole("MANAGER", "department", [
      "task:read:department",
      "task:read:own",
      "task:read:subsidiary",
    ]);
    expect(permissionLevelFor(user, "task", "read")).toBe("subsidiary");
  });
});

describe("can / assertCan", () => {
  it("can() reflects permission presence", () => {
    const user = withRole("EMPLOYEE", "own", ["task:read:own"]);
    expect(can(user, "task", "read")).toBe(true);
    expect(can(user, "risk", "read")).toBe(false);
  });

  it("assertCan() throws ForbiddenError with a 403 status and stable digest", () => {
    const user = withRole("EMPLOYEE", "own", ["task:read:own"]);
    let caught: unknown;
    try {
      assertCan(user, "risk", "read");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ForbiddenError);
    const err = caught as ForbiddenError;
    expect(err.status).toBe(403);
    expect(err.digest).toBe("FORBIDDEN");
  });

  it("assertCan() returns the level when permitted", () => {
    const user = withRole("EMPLOYEE", "own", ["task:read:own"]);
    expect(assertCan(user, "task", "read")).toBe("own");
  });
});

describe("scopeWhere — scope isolation per permission level", () => {
  it("group level sees everything (empty where)", () => {
    const user = withRole("GROUP_CEO", "group", ["risk:read:group"]);
    expect(scopeWhere(user, "risk", "read")).toEqual({});
  });

  it("subsidiary level is restricted to the user's subsidiary", () => {
    const user = withRole("SUBSIDIARY_CEO", "subsidiary", ["risk:read:subsidiary"]);
    expect(scopeWhere(user, "risk", "read")).toEqual({ subsidiaryId: "sub-1" });
  });

  it("department level sees own department rows plus rows they own", () => {
    const user = withRole("MANAGER", "department", ["task:read:department"]);
    expect(scopeWhere(user, "task", "read")).toEqual({
      OR: [{ departmentId: "dept-1" }, { ownerId: "user-1" }],
    });
  });

  it("own level sees only rows they own", () => {
    const user = withRole("EMPLOYEE", "own", ["task:read:own"]);
    expect(scopeWhere(user, "task", "read")).toEqual({ ownerId: "user-1" });
  });

  it("project ownership is membership-based, not ownerId-based", () => {
    const user = withRole("EMPLOYEE", "own", ["project:read:own"]);
    expect(scopeWhere(user, "project", "read")).toEqual({
      members: { some: { userId: "user-1" } },
    });
  });

  it("approval ownership covers both requester and approver", () => {
    const user = withRole("EMPLOYEE", "own", ["approval:read:own"]);
    expect(scopeWhere(user, "approval", "read")).toEqual({
      OR: [{ requesterId: "user-1" }, { approverId: "user-1" }],
    });
  });

  it("throws ForbiddenError when the user lacks the permission entirely", () => {
    const user = withRole("EMPLOYEE", "own", ["task:read:own"]);
    expect(() => scopeWhere(user, "risk", "read")).toThrow(ForbiddenError);
  });
});

describe("peopleScopeWhere — directory visibility", () => {
  it("group level sees the whole directory", () => {
    const user = withRole("GROUP_CEO", "group", ["people:read:group"]);
    expect(peopleScopeWhere(user)).toEqual({});
  });

  it("subsidiary level sees only their subsidiary", () => {
    const user = withRole("SUBSIDIARY_CEO", "subsidiary", ["people:read:subsidiary"]);
    expect(peopleScopeWhere(user)).toEqual({ subsidiaryId: "sub-1" });
  });

  it("department level sees their department plus themselves", () => {
    const user = withRole("MANAGER", "department", ["people:read:department"]);
    expect(peopleScopeWhere(user)).toEqual({
      OR: [{ departmentId: "dept-1" }, { id: "user-1" }],
    });
  });

  it("own level sees only their own record", () => {
    const user = withRole("EMPLOYEE", "own", ["people:read:own"]);
    expect(peopleScopeWhere(user)).toEqual({ id: "user-1" });
  });
});
