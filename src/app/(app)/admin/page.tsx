import { getCurrentUser } from "@/lib/auth";
import { assertCan } from "@/lib/rbac";
import { PageHeader } from "@/components/ui";
import { UsersAdmin, AuditLog } from "@/components/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = (await getCurrentUser())!;
  assertCan(user, "admin", "administer");

  return (
    <div>
      <PageHeader
        title="Administration"
        subtitle="User account management and the institutional audit trail. Every administrative action is recorded."
      />
      <div className="space-y-6">
        <UsersAdmin currentUserId={user.id} />
        <AuditLog />
      </div>
    </div>
  );
}
