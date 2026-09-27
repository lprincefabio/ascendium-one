import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { assertCan } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, EmptyState, PageHeader, Pill } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { MessageComposer } from "@/components/forms";

export const dynamic = "force-dynamic";

export default async function CommunicationsPage({ searchParams }: { searchParams: Promise<{ channel?: string }> }) {
  const user = (await getCurrentUser())!;
  assertCan(user, "message", "read");
  const { channel } = await searchParams;

  const channelsWhere: Prisma.ChannelWhereInput = user.isExecutive || user.isAdmin
    ? { organisationId: user.organisationId }
    : {
        organisationId: user.organisationId,
        OR: [{ subsidiaryId: null }, { subsidiaryId: user.subsidiaryId }],
      };

  const channels = await prisma.channel.findMany({
    where: channelsWhere,
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1, include: { author: { select: { firstName: true, lastName: true } } } } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  const active = channels.find((c) => c.id === channel) ?? channels[0];
  const messages = active
    ? await prisma.message.findMany({
        where: { channelId: active.id, organisationId: user.organisationId, deletedAt: null },
        include: { author: { select: { firstName: true, lastName: true, avatarHue: true } } },
        orderBy: { createdAt: "asc" },
        take: 100,
      })
    : [];

  return (
    <div>
      <PageHeader title="Communications" subtitle="Group, subsidiary and team channels" />

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card title="Channels" className="!p-3">
          {channels.length === 0 ? (
            <EmptyState title="No channels in your scope" />
          ) : (
            <ul className="space-y-1">
              {channels.map((c) => {
                const last = c.messages[0];
                return (
                  <li key={c.id}>
                    <Link
                      href={`/communications?channel=${c.id}`}
                      className={`block rounded-lg px-3 py-2 text-sm ${active?.id === c.id ? "bg-navy-deep text-white dark:bg-white/10" : "hover:bg-slate-50 dark:hover:bg-white/5"}`}
                    >
                      <span className="flex items-center gap-1.5 font-medium">
                        {c.kind === "direct" ? "@" : "#"} {c.name}
                        {c.isDemo && <Pill tone="gold">demo</Pill>}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                        {last ? `${last.author?.firstName ?? "?"}: ${last.body}` : "No messages yet"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title={active ? `${active.kind === "direct" ? "@" : "#"} ${active.name}` : "Messages"}>
          {!active ? (
            <EmptyState title="Select a channel" />
          ) : (
            <>
              {active.topic && <p className="mb-3 text-xs text-slate-500">{active.topic}</p>}
              {messages.length === 0 ? (
                <EmptyState title="No messages yet" hint="Start the conversation below." />
              ) : (
                <ul className="space-y-3">
                  {messages.map((m) => (
                    <li key={m.id} className="flex gap-2.5">
                      <span
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                        style={{ backgroundColor: `hsl(${m.author?.avatarHue ?? 217} 45% 38%)` }}
                      >
                        {m.author ? `${m.author.firstName[0]}${m.author.lastName[0]}` : "?"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">
                          <span className="font-medium text-navy-deep dark:text-white">{m.author ? `${m.author.firstName} ${m.author.lastName}` : "Unknown"}</span>
                          {" · "}{formatDateTime(m.createdAt)}
                        </p>
                        <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{m.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <MessageComposer channelId={active.id} />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
