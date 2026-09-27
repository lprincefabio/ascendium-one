"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type SearchResult = { id: string; type: string; title: string; subtitle: string | null; href: string; isDemo: boolean };
type AskResult = { answer: string; citations: { label: string; href: string }[]; confidence: "high" | "medium" | "low"; provider: string };

export default function CommandBar() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [ask, setAsk] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState<AskResult | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  const runSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
    if (res.ok) setResults(await res.json());
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => (ask ? void (async () => {})() : runSearch(q)), 200);
    return () => clearTimeout(t);
  }, [q, ask, open, runSearch]);

  async function runAsk() {
    if (q.trim().length < 3) return;
    setBusy(true);
    setAnswer(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (res.ok) setAnswer(await res.json());
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else {
      setQ("");
      setAsk(false);
      setAnswer(null);
      setResults([]);
    }
  }, [open]);

  const slots = mounted ? ["command-slot", "command-slot-mobile"] : [];

  return (
    <>
      {slots.map((id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        return createPortal(
          <button
            key={id}
            onClick={() => setOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-500 hover:border-teal dark:border-white/15 dark:bg-white/5 dark:text-slate-400"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <span className="flex-1 text-left">Ascendium Command — search or ask…</span>
            <kbd className="rounded bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-500 dark:bg-white/10">⌘K</kbd>
          </button>,
          el
        );
      })}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]" onClick={() => setOpen(false)}>
            <div className="card w-full max-w-2xl overflow-hidden p-0 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-white/10">
                <span className="text-sm font-semibold text-gold">{ask ? "◆" : "⌕"}</span>
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (ask) void runAsk();
                      else if (results[0]) {
                        setOpen(false);
                        router.push(results[0].href);
                      }
                    }
                  }}
                  placeholder={ask ? "Ask Ascendium Intelligence… (e.g. which projects are delayed?)" : "Search people, projects, documents, decisions…"}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
                <button
                  onClick={() => {
                    setAsk(!ask);
                    setAnswer(null);
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${ask ? "bg-gold text-navy-deep" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"}`}
                >
                  {ask ? "Ask AI" : "Search"}
                </button>
              </div>
              <div className="max-h-[50vh] overflow-y-auto p-2">
                {!ask && results.map((r) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() => {
                      setOpen(false);
                      router.push(r.href);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/10"
                  >
                    <span className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-teal">{r.type}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-navy-deep dark:text-white">
                        {r.title} {r.isDemo && <span className="text-[10px] font-semibold uppercase text-yellow-700 dark:text-yellow-400">[demo]</span>}
                      </span>
                      {r.subtitle && <span className="block truncate text-xs text-slate-500">{r.subtitle}</span>}
                    </span>
                  </button>
                ))}
                {!ask && q.length >= 2 && results.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-500">No results within your permissions.</p>}
                {ask && (
                  <div className="p-3">
                    {busy && <p className="text-sm text-slate-500">Ascendium Intelligence is thinking…</p>}
                    {answer && (
                      <div className="space-y-3">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{answer.answer}</p>
                        {answer.citations.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Sources</p>
                            <div className="flex flex-wrap gap-2">
                              {answer.citations.map((c, i) => (
                                <button key={i} onClick={() => { setOpen(false); router.push(c.href); }} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-teal hover:border-teal dark:border-white/15">
                                  {c.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <p className="text-[11px] text-slate-500">
                          Confidence: {answer.confidence} · Provider: {answer.provider} · Verify against cited sources before acting.
                        </p>
                      </div>
                    )}
                    {!busy && !answer && <p className="text-sm text-slate-500">Ask about projects, KPIs, risks, decisions — scoped to what you are authorised to see.</p>}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
