import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const items = await prisma.notification.findMany({
    where: { organisationId: user.organisationId, userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, title: true, body: true, severity: true, kind: true, link: true, readAt: true, createdAt: true },
  });
  return NextResponse.json(items);
}

const markSchema = z.object({ id: z.string().optional(), all: z.boolean().optional() });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const parsed = markSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  if (parsed.data.all) {
    await prisma.notification.updateMany({
      where: { organisationId: user.organisationId, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
  } else if (parsed.data.id) {
    await prisma.notification.updateMany({
      where: { id: parsed.data.id, organisationId: user.organisationId, userId: user.id },
      data: { readAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true });
}
