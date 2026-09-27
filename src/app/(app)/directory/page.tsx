import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { assertCan, peopleScopeWhere } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Avatar, Card, EmptyState, PageHeader, Pill, Table } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = (await getCurrentUser())!;
  const level = assertCan(user, "people", "read");
  const { q } = await searchParams;

  const scope = peopleScopeWhere(user) as Prisma.UserWhereInput;
  const people = await prisma.user.findMany({
    where: {
      organisationId: user.organisationId,
      isActive: true,
      ...scope,
      ...(q ? { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { title: { contains: q } }, { email: { contains: q } }] } : {}),
    },
    include: {
      role: { select: { name: true } },
      subsidiary: { select: { name: true, slug: true } },
      department: { select: { name: true } },
      manager: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ subsidiaryId: "asc" }, { lastName: "asc" }],
    take: 300,
  });

  return (
    <div>
      <PageHeader
        title="Directory"
        subtitle={`${people.length} people visible to you${level !== "group" ? ` · visibility: ${level} level` : ""}`}
      />

      <form method="GET" className="mb-4 flex max-w-md gap-2">
        <input name="q" defaultValue={q ?? ""} placeholder="Search name, title or email…" className="input" />
        <button className="btn-primary shrink-0">Search</button>
      </form>

      <Card>
        {people.length === 0 ? (
          <EmptyState title="No people match" />
        ) : (
          <Table head={["Person", "Role", "Subsidiary", "Department", "Reports to"]}>
            {people.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                <td className="td">
                  <span className="flex items-center gap-2.5">
                    <Avatar first={p.firstName} last={p.lastName} hue={p.avatarHue} size={7} />
                    <span>
                      <span className="flex items-center gap-1.5 font-medium text-navy-deep dark:text-white">
                        {p.firstName} {p.lastName}
                        {p.isDemo && <Pill tone="gold">demo</Pill>}
                      </span>
                      <span className="block text-xs text-slate-500">{p.title ?? "—"}</span>
                    </span>
                  </span>
                </td>
                <td className="td text-slate-600 dark:text-slate-300">{p.role?.name ?? "—"}</td>
                <td className="td text-slate-600 dark:text-slate-300">{p.subsidiary?.name ?? "Group"}</td>
                <td className="td text-slate-600 dark:text-slate-300">{p.department?.name ?? "—"}</td>
                <td className="td text-slate-600 dark:text-slate-300">{p.manager ? `${p.manager.firstName} ${p.manager.lastName}` : "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
