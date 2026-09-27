"use client";

import { useCallback, useEffect, useState } from "react";

type AdminUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  title: string | null;
  isActive: boolean;
  isExecutive: boolean;
  isAdmin: boolean;
  isDemo: boolean;
  role: { name: string; code: string } | null;
  subsidiary: { name: string } | null;
  department: { name: string } | null;
  lastLoginAt: string | null;
  createdAt: string;
};

type AuditEvent = {
  id: string;
  actorEmail: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  previousValue: string | null;
  newValue: string | null;
  reason: string | null;
  ip: string | null;
  createdAt: string;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}

function formatDateTime(d: string | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

export function UsersAdmin({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setError(null);
    try {
      const data = await request<AdminUser[]>(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
      setUsers(null);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query), 250);
    return () => clearTimeout(t);
  }, [query, load]);

  async function toggleActive(u: AdminUser) {
    setBusyId(u.id);
    setError(null);
    try {
      await request("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, isActive: !u.isActive }),
      });
      setUsers((prev) => prev?.map((x) => (x.id === u.id ? { ...x, isActive: !u.isActive } : x)) ?? prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="card p-4 sm:p-5">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-navy-deep dark:text-white">User accounts</h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email…"
          className="input w-full sm:w-64"
          aria-label="Search users"
        />
      </header>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

      {users === null ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading users…</p>
      ) : users.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No users match your search.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10">
                <th className="th">User</th>
                <th className="th">Role</th>
                <th className="th">Subsidiary</th>
                <th className="th">Department</th>
                <th className="th">Last login</th>
                <th className="th">Status</th>
                <th className="th"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="td">
                    <span className="flex items-center gap-2 font-medium text-navy-deep dark:text-white">
                      {u.firstName} {u.lastName}
                      {u.isDemo && <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-yellow-800 dark:text-yellow-300">demo</span>}
                    </span>
                    <span className="block text-xs text-slate-500">{u.email}</span>
                    {u.title && <span className="block text-xs text-slate-400">{u.title}</span>}
                  </td>
                  <td className="td text-slate-600 dark:text-slate-300">{u.role?.name ?? "—"}</td>
                  <td className="td text-slate-600 dark:text-slate-300">{u.subsidiary?.name ?? "Group"}</td>
                  <td className="td text-slate-600 dark:text-slate-300">{u.department?.name ?? "—"}</td>
                  <td className="td text-slate-600 dark:text-slate-300">{formatDateTime(u.lastLoginAt)}</td>
                  <td className="td">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${u.isActive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"}`}>
                      {u.isActive ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td className="td text-right">
                    {u.id !== currentUserId && (
                      <button
                        type="button"
                        onClick={() => toggleActive(u)}
                        disabled={busyId === u.id}
                        className={u.isActive ? "btn-ghost text-xs" : "btn-primary text-xs"}
                      >
                        {busyId === u.id ? "…" : u.isActive ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function AuditLog() {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    request<AuditEvent[]>("/api/audit")
      .then((data) => !cancelled && setEvents(data))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load audit trail"));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="card p-4 sm:p-5">
      <header className="mb-3">
        <h2 className="font-display text-base font-semibold text-navy-deep dark:text-white">Audit trail</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Latest 100 recorded events across the organisation.</p>
      </header>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

      {events === null ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading audit trail…</p>
      ) : events.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No audit events recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10">
                <th className="th">When</th>
                <th className="th">Actor</th>
                <th className="th">Action</th>
                <th className="th">Resource</th>
                <th className="th">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="td whitespace-nowrap text-slate-600 dark:text-slate-300">{formatDateTime(e.createdAt)}</td>
                  <td className="td text-slate-600 dark:text-slate-300">{e.actorEmail ?? "System"}</td>
                  <td className="td">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-navy-deep dark:bg-white/10 dark:text-white">{e.action}</code>
                  </td>
                  <td className="td text-slate-600 dark:text-slate-300">
                    {e.resourceType ? `${e.resourceType}${e.resourceId ? ` · ${e.resourceId.slice(0, 8)}` : ""}` : "—"}
                  </td>
                  <td className="td max-w-md truncate text-slate-500 dark:text-slate-400">{e.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
