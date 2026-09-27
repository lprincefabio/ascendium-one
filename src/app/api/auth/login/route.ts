import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, hashToken, SESSION_COOKIE, sessionCookieOptions, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

function clientMeta(req: NextRequest) {
  return { ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null, userAgent: req.headers.get("user-agent") ?? null };
}

export async function POST(req: NextRequest) {
  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { role: true } });
  // Constant-shape response whether or not the account exists.
  const invalid = NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  if (!user || !user.isActive) {
    await prisma.loginEvent.create({
      data: { userId: user?.id ?? null, email: email.toLowerCase(), success: false, ...clientMeta(req) },
    });
    return invalid;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  await prisma.loginEvent.create({
    data: { userId: user.id, email: user.email, success: ok, ...clientMeta(req) },
  });
  if (!ok) return invalid;

  const meta = clientMeta(req);
  const token = await createSession(user.id, { ip: meta.ip ?? undefined, userAgent: meta.userAgent ?? undefined });
  await audit(
    { organisationId: user.organisationId, id: user.id, email: user.email },
    { action: "auth.login", resourceType: "session", reason: "User signed in", ip: meta.ip }
  );

  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
  return NextResponse.json({ ok: true, name: `${user.firstName} ${user.lastName}` });
}

export async function DELETE(req: NextRequest) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await destroySession(token);
    store.delete(SESSION_COOKIE);
  }
  return NextResponse.json({ ok: true });
}
