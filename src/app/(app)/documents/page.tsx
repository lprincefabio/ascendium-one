import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { assertCan, scopeWhere } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, EmptyState, PageHeader, Pill, StatusPill, Table, RowLink } from "@/components/ui";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const user = (await getCurrentUser())!;
  assertCan(user, "document", "read");
  const { type } = await searchParams;

  const scope = scopeWhere(user, "document", "read") as Prisma.DocumentWhereInput;
  const documents = await prisma.document.findMany({
    where: {
      organisationId: user.organisationId,
      deletedAt: null,
      ...scope,
      ...(type ? { docType: type } : {}),
    },
    include: {
      owner: { select: { firstName: true, lastName: true } },
      subsidiary: { select: { name: true } },
      project: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const types = ["policy", "contract", "report", "presentation", "note", "minutes", "brief"];

  return (
    <div>
      <PageHeader title="Documents" subtitle={`${documents.length} documents in your scope`} />

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/documents" className={`rounded-full px-3 py-1 text-xs font-medium ${!type ? "bg-navy-deep text-gold dark:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300"}`}>All types</Link>
        {types.map((t) => (
          <Link key={t} href={`/documents?type=${t}`} className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${type === t ? "bg-navy-deep text-gold dark:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300"}`}>{t}</Link>
        ))}
      </div>

      <Card>
        {documents.length === 0 ? (
          <EmptyState title="No documents in your scope" />
        ) : (
          <Table head={["Title", "Type", "Scope", "Status", "Owner", "Updated"]}>
            {documents.map((d) => (
              <RowLink
                key={d.id}
                href={`/documents/${d.id}`}
                cells={[
                  <span key="t" className="flex items-center gap-2">
                    {d.title}
                    {d.isDemo && <Pill tone="gold">demo</Pill>}
                    {d.version > 1 && <Pill tone="slate">v{d.version}</Pill>}
                  </span>,
                  <span key="ty" className="capitalize text-slate-600 dark:text-slate-300">{d.docType}</span>,
                  <span key="s" className="text-slate-500 dark:text-slate-400">{d.subsidiary?.name ?? d.project?.name ?? "Group"}</span>,
                  <StatusPill key="st" status={d.status} />,
                  <span key="o" className="text-slate-600 dark:text-slate-300">{d.owner ? `${d.owner.firstName} ${d.owner.lastName}` : "—"}</span>,
                  <span key="u" className="text-slate-600 dark:text-slate-300">{formatDate(d.updatedAt)}</span>,
                ]}
              />
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
