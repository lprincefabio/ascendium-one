import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { cache } from "react";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { parsePermissions, type Permission, type PermissionLevel, LEVEL_RANK } from "@/lib/domain";

export const SESSION_COOKIE = "ao_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export type SessionUser = {
  id: string;
  organisationId: string;
  email: string;
  firstName: string;
  lastName: string;
  title: string | null;
  subsidiaryId: string | null;
  departmentId: string | null;
  managerId: string | null;
  isExecutive: boolean;
  isAdmin: boolean;
  avatarHue: number;
  role: { code: string; name: string; level: string; permissions: Permission[] } | null;
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  userId: string,
  meta: { ip?: string; userAgent?: string } = {}
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await prisma.session.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: { role: true },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (!session.user.isActive) return null;

  const u = session.user;
  return {
    id: u.id,
    organisationId: u.organisationId,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    title: u.title,
    subsidiaryId: u.subsidiaryId,
    departmentId: u.departmentId,
    managerId: u.managerId,
    isExecutive: u.isExecutive,
    isAdmin: u.isAdmin,
    avatarHue: u.avatarHue,
    role: u.role
      ? {
          code: u.role.code,
          name: u.role.name,
          level: u.role.level,
          permissions: parsePermissions(u.role.permissions),
        }
      : null,
  };
});

export function requireUser(user: SessionUser | null): SessionUser {
  if (!user) throw new AuthError("Authentication required");
  return user;
}

export class AuthError extends Error {
  status = 401;
}

/** Highest permission level the user holds for a resource+action, or null. */
export function permissionLevelFor(
  user: SessionUser,
  resource: string,
  action: string
): PermissionLevel | null {
  if (user.isAdmin) return "group";
  if (!user.role) return null;
  let best: PermissionLevel | null = null;
  for (const p of user.role.permissions) {
    const [r, a, level] = p.split(":");
    if (r !== resource || a !== action) continue;
    if (!best || LEVEL_RANK[level as PermissionLevel] > LEVEL_RANK[best]) {
      best = level as PermissionLevel;
    }
  }
  return best;
}
