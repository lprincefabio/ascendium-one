"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type DeptNode = {
  id: string;
  name: string;
  mission: string | null;
  headName: string | null;
  peopleCount: number;
};

export type SubNode = {
  id: string;
  name: string;
  slug: string;
  sector: string | null;
  isDemo: boolean;
  peopleCount: number;
  projectCount: number;
  departments: DeptNode[];
};

export type ClusterNode = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  subsidiaries: SubNode[];
};

type Selection =
  | { kind: "cluster"; id: string }
  | { kind: "subsidiary"; id: string }
  | { kind: "department"; id: string; parentName: string }
  | null;

function matches(text: string | null | undefined, q: string) {
  return (text ?? "").toLowerCase().includes(q);
}

export function OrgMap({ clusters }: { clusters: ClusterNode[] }) {
  const [query, setQuery] = useState("");
  const [openClusters, setOpenClusters] = useState<Set<string>>(() => new Set(clusters.map((c) => c.id)));
  const [openSubs, setOpenSubs] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<Selection>(null);

  const q = query.trim().toLowerCase();
  const filtering = q.length > 0;

  const filtered = useMemo(() => {
    if (!filtering) return clusters;
    return clusters
      .map((c) => {
        if (matches(c.name, q) || matches(c.description, q)) return c;
        const subs = c.subsidiaries
          .map((s) => {
            if (matches(s.name, q) || matches(s.sector, q)) return s;
            const depts = s.departments.filter((d) => matches(d.name, q) || matches(d.mission, q) || matches(d.headName, q));
            return depts.length > 0 ? { ...s, departments: depts } : null;
          })
          .filter((s): s is SubNode => s !== null);
        return subs.length > 0 ? { ...c, subsidiaries: subs } : null;
      })
      .filter((c): c is ClusterNode => c !== null);
  }, [clusters, q, filtering]);

  const selectedData = useMemo(() => {
    if (!selected) return null;
    for (const c of filtered.length > 0 || !filtering ? clusters : []) {
      if (selected.kind === "cluster" && c.id === selected.id) {
        return { kind: "cluster" as const, node: c, breadcrumb: c.name };
      }
      for (const s of c.subsidiaries) {
        if (selected.kind === "subsidiary" && s.id === selected.id) {
          return { kind: "subsidiary" as const, node: s, breadcrumb: `${c.name} · ${s.name}` };
        }
        if (selected.kind === "department") {
          const d = s.departments.find((d) => d.id === selected.id);
          if (d) return { kind: "department" as const, node: d, breadcrumb: `${c.name} · ${s.name} · ${d.name}` };
        }
      }
    }
    return null;
  }, [selected, clusters, filtered.length, filtering]);

  function toggleCluster(id: string) {
    setOpenClusters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSub(id: string) {
    setOpenSubs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isClusterOpen = (id: string) => filtering || openClusters.has(id);
  const isSubOpen = (id: string) => filtering || openSubs.has(id);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter the map — search enterprises, departments, leaders…"
            className="input w-full"
            aria-label="Filter Ascendium Map"
          />
          {filtering && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {filtered.reduce((n, c) => n + c.subsidiaries.length, 0)} enterprises match “{query.trim()}”
            </p>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="card p-6 text-center text-sm text-slate-500 dark:text-slate-400">No nodes match your filter.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((c) => {
              const totalPeople = c.subsidiaries.reduce((n, s) => n + s.peopleCount, 0);
              return (
                <section key={c.id} className="card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleCluster(c.id)}
                    onDoubleClick={() => setSelected({ kind: "cluster", id: c.id })}
                    className="flex w-full items-center justify-between gap-3 bg-navy-deep px-4 py-3 text-left"
                    aria-expanded={isClusterOpen(c.id)}
                  >
                    <span>
                      <span className="font-display block text-sm font-semibold text-white">{c.name}</span>
                      <span className="block text-xs text-slate-400">
                        {c.subsidiaries.length} enterprises · {totalPeople} people
                      </span>
                    </span>
                    <span className="text-gold" aria-hidden>{isClusterOpen(c.id) ? "▾" : "▸"}</span>
                  </button>

                  {isClusterOpen(c.id) && (
                    <ul className="divide-y divide-slate-100 dark:divide-white/5">
                      {c.subsidiaries.map((s) => (
                        <li key={s.id}>
                          <div
                            className={`flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors ${
                              selected?.kind === "subsidiary" && selected.id === s.id
                                ? "bg-gold/10"
                                : "hover:bg-slate-50 dark:hover:bg-white/5"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleSub(s.id)}
                              className="text-slate-400 hover:text-navy-deep dark:hover:text-white"
                              aria-label={isSubOpen(s.id) ? `Collapse ${s.name}` : `Expand ${s.name}`}
                              aria-expanded={isSubOpen(s.id)}
                            >
                              {isSubOpen(s.id) ? "▾" : "▸"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelected({ kind: "subsidiary", id: s.id })}
                              className="min-w-0 flex-1"
                            >
                              <span className="block truncate text-sm font-medium text-navy-deep dark:text-white">
                                {s.name}
                                {s.isDemo && <span className="ml-2 rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-yellow-800 dark:text-yellow-300">demo</span>}
                              </span>
                              <span className="block truncate text-xs capitalize text-slate-500 dark:text-slate-400">
                                {s.sector ?? "enterprise"} · {s.peopleCount} people · {s.projectCount} projects
                              </span>
                            </button>
                          </div>

                          {isSubOpen(s.id) && s.departments.length > 0 && (
                            <ul className="bg-slate-50/60 dark:bg-white/[0.02]">
                              {s.departments.map((d) => (
                                <li key={d.id}>
                                  <button
                                    type="button"
                                    onClick={() => setSelected({ kind: "department", id: d.id, parentName: s.name })}
                                    className={`flex w-full items-center justify-between gap-2 py-1.5 pl-10 pr-4 text-left text-xs transition-colors ${
                                      selected?.kind === "department" && selected.id === d.id
                                        ? "bg-gold/10 text-navy-deep dark:text-white"
                                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                                    }`}
                                  >
                                    <span className="truncate">{d.name}</span>
                                    <span className="shrink-0 text-slate-400">{d.peopleCount}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      <aside className="card h-fit p-4 lg:sticky lg:top-4" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Node detail</p>
        {!selectedData ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Select a cluster, enterprise, or department on the map to inspect it here.
          </p>
        ) : (
          <div className="mt-2 space-y-3">
            <p className="text-xs text-slate-400 dark:text-slate-500">{selectedData.breadcrumb}</p>

            {selectedData.kind === "cluster" && (
              <>
                <h3 className="font-display text-lg font-semibold text-navy-deep dark:text-white">{selectedData.node.name}</h3>
                {selectedData.node.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-300">{selectedData.node.description}</p>
                )}
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between"><dt className="text-slate-500">Enterprises</dt><dd className="font-medium text-navy-deep dark:text-white">{selectedData.node.subsidiaries.length}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Departments</dt><dd className="font-medium text-navy-deep dark:text-white">{selectedData.node.subsidiaries.reduce((n, s) => n + s.departments.length, 0)}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">People</dt><dd className="font-medium text-navy-deep dark:text-white">{selectedData.node.subsidiaries.reduce((n, s) => n + s.peopleCount, 0)}</dd></div>
                </dl>
              </>
            )}

            {selectedData.kind === "subsidiary" && (
              <>
                <h3 className="font-display text-lg font-semibold text-navy-deep dark:text-white">{selectedData.node.name}</h3>
                {selectedData.node.sector && <p className="text-sm capitalize text-slate-500">{selectedData.node.sector}</p>}
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between"><dt className="text-slate-500">Departments</dt><dd className="font-medium text-navy-deep dark:text-white">{selectedData.node.departments.length}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">People</dt><dd className="font-medium text-navy-deep dark:text-white">{selectedData.node.peopleCount}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Projects</dt><dd className="font-medium text-navy-deep dark:text-white">{selectedData.node.projectCount}</dd></div>
                </dl>
                <Link href={`/subsidiaries/${selectedData.node.slug}`} className="btn-primary inline-block">
                  Open enterprise page
                </Link>
              </>
            )}

            {selectedData.kind === "department" && (
              <>
                <h3 className="font-display text-lg font-semibold text-navy-deep dark:text-white">{selectedData.node.name}</h3>
                {selectedData.node.mission && <p className="text-sm text-slate-600 dark:text-slate-300">{selectedData.node.mission}</p>}
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between"><dt className="text-slate-500">Head</dt><dd className="font-medium text-navy-deep dark:text-white">{selectedData.node.headName ?? "Vacant"}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">People</dt><dd className="font-medium text-navy-deep dark:text-white">{selectedData.node.peopleCount}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Enterprise</dt><dd className="font-medium text-navy-deep dark:text-white">{(selected as { parentName?: string })?.parentName ?? "—"}</dd></div>
                </dl>
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
