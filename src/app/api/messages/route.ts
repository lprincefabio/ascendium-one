import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { assertCan } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const schema = z.object({
  channelId: z.string(),
  body: z.string().min(1).max(5000),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  assertCan(user, "message", "create");

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid message payload" }, { status: 400 });
  const d = parsed.data;

  const channel = await prisma.channel.findFirst({ where: { id: d.channelId, organisationId: user.organisationId } });
  if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  if (channel.subsidiaryId && channel.subsidiaryId !== user.subsidiaryId && !user.isExecutive && !user.isAdmin) {
    return NextResponse.json({ error: "Channel is outside your subsidiary scope" }, { status: 403 });
  }

  const message = await prisma.message.create({
    data: {
      organisationId: user.organisationId,
      channelId: channel.id,
      authorId: user.id,
      body: d.body,
      isDemo: false,
    },
  });

  await audit(user, {
    action: "message.create",
    resourceType: "message",
    resourceId: message.id,
    newValue: { channel: channel.name },
    reason: "Message posted",
  });
  return NextResponse.json({ ok: true, id: message.id });
}
