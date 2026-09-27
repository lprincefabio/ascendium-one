import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { assertCan } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, DemoBadge, PageHeader, Pill, StatusPill } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function parseTags(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((t: unknown) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = (await getCurrentUser())!;
  assertCan(user, "document", "read");
  const { id } = await params;

  const doc = await prisma.document.findFirst({
    where: { id, organisationId: user.organisationId, deletedAt: null },
    include: {
      owner: { select: { firstName: true, lastName: true } },
      approvedBy: { select: { firstName: true, lastName: true } },
      subsidiary: { select: { name: true } },
      department: { select: { name: true } },
      project: { select: { name: true } },
      versions: { orderBy: { version: "desc" } },
    },
  });
  if (!doc) notFound();

  const tags = parseTags(doc.tags);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {doc.title}
            {doc.isDemo && <DemoBadge />}
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2">
            <Pill tone="slate">{doc.docType}</Pill>
            <StatusPill status={doc.status} />
            <span>v{doc.version}</span>
            {doc.subsidiary && <span>· {doc.subsidiary.name}</span>}
            {doc.department && <span>· {doc.department.name}</span>}
            {doc.project && <span>· {doc.project.name}</span>}
          </span>
        }
      />

      <Card title="Content">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{doc.body || "No content."}</p>
      </Card>

      {tags.length > 0 && (
        <Card title="Tags" className="mt-4">
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => <Pill key={t} tone="teal">{t}</Pill>)}
          </div>
        </Card>
      )}

      <Card title="Record" className="mt-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">Owner</dt><dd className="text-navy-deep dark:text-white">{doc.owner ? `${doc.owner.firstName} ${doc.owner.lastName}` : "—"}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">Approved by</dt><dd className="text-navy-deep dark:text-white">{doc.approvedBy ? `${doc.approvedBy.firstName} ${doc.approvedBy.lastName}` : "—"}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">Created</dt><dd className="text-navy-deep dark:text-white">{formatDateTime(doc.createdAt)}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">Last updated</dt><dd className="text-navy-deep dark:text-white">{formatDateTime(doc.updatedAt)}</dd></div>
        </dl>
      </Card>

      {doc.versions.length > 0 && (
        <Card title={`Version history (${doc.versions.length})`} className="mt-4">
          <ul className="space-y-1.5 text-sm">
            {doc.versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between">
                <span className="font-medium text-navy-deep dark:text-white">Version {v.version}</span>
                <span className="text-xs text-slate-500">{formatDateTime(v.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
