import { redirect } from "next/navigation";
import { getCurrentUser, permissionLevelFor } from "@/lib/auth";
import { RESOURCES, ACTIONS } from "@/lib/domain";
import AppShell from "@/components/shell";
import CommandBar from "@/components/command";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Pre-compute every allowed resource:action pair server-side; the shell
  // never exposes nav entries the user cannot read.
  const allowed: string[] = [];
  if (user.isAdmin) {
    for (const r of RESOURCES) for (const a of ACTIONS) allowed.push(`${r}:${a}`);
  } else {
    for (const r of RESOURCES) {
      for (const a of ACTIONS) {
        if (permissionLevelFor(user, r, a)) allowed.push(`${r}:${a}`);
      }
    }
  }

  return (
    <AppShell
      user={{
        firstName: user.firstName,
        lastName: user.lastName,
        title: user.title,
        roleName: user.role?.name ?? null,
        email: user.email,
        avatarHue: user.avatarHue,
        isAdmin: user.isAdmin,
      }}
      allowed={allowed}
    >
      <CommandBar />
      {children}
    </AppShell>
  );
}
