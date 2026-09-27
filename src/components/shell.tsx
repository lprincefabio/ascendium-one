"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

export type ShellUser = {
  firstName: string;
  lastName: string;
  title: string | null;
  roleName: string | null;
  email: string;
  avatarHue: number;
  isAdmin: boolean;
};

type NavItem = { href: string; label: string; resource: string; exact?: boolean };

const NAV: NavItem[] = [
  { href: "/", label: "Command Centre", resource: "dashboard", exact: true },
  { href: "/org-map", label: "Ascendium Map", resource: "subsidiary" },
  { href: "/tasks", label: "Tasks", resource: "task" },
  { href: "/projects", label: "Projects", resource: "project" },
  { href: "/kpis", label: "KPIs", resource: "kpi" },
  { href: "/strategy", label: "Strategy", resource: "strategy" },
  { href: "/decisions", label: "Decision Room", resource: "decision" },
  { href: "/approvals", label: "Approvals", resource: "approval" },
  { href: "/risks", label: "Risks", resource: "risk" },
  { href: "/documents", label: "Documents", resource: "document" },
  { href: "/meetings", label: "Meetings", resource: "meeting" },
  { href: "/communications", label: "Communications", resource: "message" },
  { href: "/announcements", label: "Announcements", resource: "announcement" },
  { href: "/directory", label: "Directory", resource: "people" },
  { href: "/subsidiaries", label: "Subsidiaries", resource: "subsidiary" },
  { href: "/incidents", label: "Continuity", resource: "incident" },
  { href: "/opportunities", label: "Opportunities", resource: "opportunity" },
  { href: "/issues", label: "Issues", resource: "issue" },
  { href: "/admin", label: "Administration", resource: "admin" },
];

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("ao-theme", next ? "dark" : "light");
    setDark(next);
  }
  return (
    <button onClick={toggle} className="btn-ghost !px-2.5" title="Toggle light / dark" aria-label="Toggle theme">
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
      )}
    </button>
  );
}

function Bell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ id: string; title: string; body: string | null; severity: string; link: string | null; readAt: string | null; createdAt: string }[]>([]);
  const router = useRouter();

  async function load() {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    if (res.ok) setItems(await res.json());
  }
  useEffect(() => {
    if (open) void load();
  }, [open]);

  const unread = items.filter((i) => !i.readAt).length;

  async function markRead(id: string, link: string | null) {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setOpen(false);
    if (link) router.push(link);
    else void load();
  }

  return (
    <div className="relative">
      <button className="btn-ghost relative !px-2.5" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 z-40 mt-2 w-80 p-2 shadow-lg">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Notifications</p>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && <p className="px-2 py-4 text-center text-sm text-slate-500">No notifications.</p>}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n.id, n.link)}
                className={`block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/10 ${n.readAt ? "opacity-60" : ""}`}
              >
                <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${n.severity === "critical" ? "bg-red-500" : n.severity === "important" ? "bg-amber-500" : "bg-slate-400"}`} />
                <span className="font-medium">{n.title}</span>
                {n.body && <span className="mt-0.5 block truncate text-xs text-slate-500">{n.body}</span>}
              </button>
            ))}
          </div>
          {unread > 0 && (
            <button
              className="mt-1 w-full rounded-lg px-2 py-1.5 text-center text-xs font-medium text-teal hover:bg-slate-50 dark:hover:bg-white/10"
              onClick={async () => {
                await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
                void load();
              }}
            >
              Mark all read
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AppShell({
  user,
  allowed,
  children,
}: {
  user: ShellUser;
  allowed: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const items = NAV.filter((n) => n.resource === "dashboard" || allowed.includes(`${n.resource}:read`));

  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  async function logout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-navy-deep text-slate-300 lg:flex dark:border-white/10">
        <Link href="/" className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
          <Image src="/brand/ascendium-logo.png" alt="Ascendium Global Holdings" width={168} height={48} priority />
        </Link>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {items.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active(n.href, n.exact) ? "bg-gold/15 text-gold" : "hover:bg-white/5 hover:text-white"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 px-4 py-3 text-[11px] leading-relaxed text-slate-400">
          Ascendium One
          <br />
          © {new Date().getFullYear()} Ascendium Global Holdings
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur lg:hidden dark:border-white/10 dark:bg-navy-deep/95">
        <Link href="/" className="flex items-center">
          <Image src="/brand/ascendium-logo.png" alt="Ascendium" width={132} height={38} priority />
        </Link>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Bell />
          <button className="btn-ghost !px-2.5" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <nav className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-navy-deep p-3 text-slate-300">
            <div className="mb-3 px-2">
              <Image src="/brand/ascendium-logo.png" alt="Ascendium Global Holdings" width={168} height={48} priority />
            </div>
            {items.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMenuOpen(false)}
                className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${active(n.href, n.exact) ? "bg-gold/15 text-gold" : "hover:bg-white/5"}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Desktop top bar */}
      <header className="sticky top-0 z-20 hidden items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-2.5 backdrop-blur lg:flex dark:border-white/10 dark:bg-navy-deep/95">
        <div className="min-w-0 flex-1">{/* Command bar mounts here via portal slot */}<div id="command-slot" className="max-w-xl" /></div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Bell />
          <div className="relative">
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => setMenuOpen((o) => !o)}>
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: `hsl(${user.avatarHue} 45% 38%)` }}
              >
                {user.firstName[0]}
                {user.lastName[0]}
              </span>
              <span className="hidden text-left xl:block">
                <span className="block text-sm font-medium text-navy-deep dark:text-white">{user.firstName} {user.lastName}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{user.roleName ?? user.title ?? ""}</span>
              </span>
            </button>
            {menuOpen && (
              <div className="card absolute right-0 z-40 mt-2 w-56 p-2 shadow-lg">
                <p className="px-2 py-1 text-sm font-medium text-navy-deep dark:text-white">{user.firstName} {user.lastName}</p>
                <p className="px-2 pb-2 text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                <button onClick={logout} className="w-full rounded-lg px-2 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile command bar row */}
      <div className="border-b border-slate-200 bg-white px-3 py-2 lg:hidden dark:border-white/10 dark:bg-navy-deep">
        <div id="command-slot-mobile" className="mx-auto w-full max-w-xl" />
      </div>

      <main className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6">{children}</main>
    </div>
  );
}
