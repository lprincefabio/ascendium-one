import { getCurrentUser, permissionLevelFor } from "@/lib/auth";
import { assertCan } from "@/lib/rbac";
import { LEVEL_RANK } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { OrgMap, type ClusterNode } from "@/components/org-map";

export const dynamic = "force-dynamic";

export default async function OrgMapPage() {
  const user = (await getCurrentUser())!;
  assertCan(user, "subsidiary", "read");
  const level = permissionLevelFor(user, "subsidiary", "read")!;

  const clusters = await prisma.cluster.findMany({
    where: { organisationId: user.organisationId, deletedAt: null },
    orderBy: { sortOrder: "asc" },
    include: {
      subsidiaries: {
        where: {
          status: "active",
          deletedAt: null,
          ...(LEVEL_RANK[level] >= LEVEL_RANK.group ? {} : { id: user.subsidiaryId ?? "" }),
        },
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: { users: { where: { isActive: true, deletedAt: null } }, projects: { where: { deletedAt: null } } },
          },
          departments: {
            where: { deletedAt: null },
            orderBy: { name: "asc" },
            include: {
              head: { select: { firstName: true, lastName: true } },
              _count: { select: { users: { where: { isActive: true, deletedAt: null } } } },
            },
          },
        },
      },
    },
  });

  const tree: ClusterNode[] = clusters.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    sortOrder: c.sortOrder,
    subsidiaries: c.subsidiaries.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      sector: s.sector,
      isDemo: s.isDemo,
      peopleCount: s._count.users,
      projectCount: s._count.projects,
      departments: s.departments.map((d) => ({
        id: d.id,
        name: d.name,
        mission: d.mission,
        headName: d.head ? `${d.head.firstName} ${d.head.lastName}` : null,
        peopleCount: d._count.users,
      })),
    })),
  }));

  const subCount = tree.reduce((n, c) => n + c.subsidiaries.length, 0);
  const deptCount = tree.reduce((n, c) => n + c.subsidiaries.reduce((m, s) => m + s.departments.length, 0), 0);

  return (
    <div>
      <PageHeader
        title="Ascendium Map"
        subtitle={`The AGH enterprise graph — ${subCount} enterprises and ${deptCount} departments${level !== "group" ? " in your scope" : " across the Ascendium Global Holdings ecosystem"}. Select any node to inspect it.`}
      />
      <OrgMap clusters={tree} />
    </div>
  );
}
