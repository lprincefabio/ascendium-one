"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: res.ok, error: data.error };
}

export function TaskCreateForm({
  projects,
  people,
  canAssignOthers,
}: {
  projects: { id: string; name: string }[];
  people: { id: string; name: string }[];
  canAssignOthers: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await post("/api/tasks", {
      title,
      description: description || undefined,
      priority,
      dueDate: dueDate || undefined,
      projectId: projectId || undefined,
      ownerId: ownerId || undefined,
    });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Could not create task");
    setOpen(false);
    setTitle(""); setDescription(""); setPriority("medium"); setDueDate(""); setProjectId(""); setOwnerId("");
    router.refresh();
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>New task</button>
    );
  }
  return (
    <form onSubmit={submit} className="card mb-5 space-y-3 p-4">
      <p className="font-display text-sm font-semibold text-navy-deep dark:text-white">Create task</p>
      <input className="input" placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} />
      <textarea className="input" placeholder="Description (optional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-xs text-slate-500 dark:text-slate-400">
          Priority
          <select className="input mt-1" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className="block text-xs text-slate-500 dark:text-slate-400">
          Due date
          <input type="date" className="input mt-1" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <label className="block text-xs text-slate-500 dark:text-slate-400">
          Project
          <select className="input mt-1" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">None</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        {canAssignOthers && (
          <label className="block text-xs text-slate-500 dark:text-slate-400">
            Owner
            <select className="input mt-1" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Myself</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? "Creating…" : "Create task"}</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

const TASK_STATUSES = ["todo", "in_progress", "blocked", "review", "done", "cancelled"] as const;

export function TaskStatusControl({ taskId, status }: { taskId: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [error, setError] = useState<string | null>(null);

  async function change(next: string) {
    setValue(next);
    const r = await post("/api/tasks", { id: taskId, status: next });
    if (!r.ok) {
      setError(r.error ?? "Update failed");
      setValue(status);
    } else {
      setError(null);
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select className="input !w-auto" value={value} onChange={(e) => change(e.target.value)} aria-label="Task status">
        {TASK_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
      </select>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}

export function DecisionCreateForm({ subsidiaries }: { subsidiaries: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [problem, setProblem] = useState("");
  const [options, setOptions] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [financialImplication, setFinancialImplication] = useState("");
  const [decisionDeadline, setDecisionDeadline] = useState("");
  const [subsidiaryId, setSubsidiaryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await post("/api/decisions", {
      title,
      context: context || undefined,
      problem: problem || undefined,
      options: options || undefined,
      recommendation: recommendation || undefined,
      financialImplication: financialImplication || undefined,
      decisionDeadline: decisionDeadline || undefined,
      subsidiaryId: subsidiaryId || undefined,
    });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Could not frame decision");
    setOpen(false);
    setTitle(""); setContext(""); setProblem(""); setOptions(""); setRecommendation(""); setFinancialImplication(""); setDecisionDeadline(""); setSubsidiaryId("");
    router.refresh();
  }

  if (!open) return <button className="btn-primary" onClick={() => setOpen(true)}>Frame a decision</button>;
  return (
    <form onSubmit={submit} className="card mb-5 space-y-3 p-4">
      <p className="font-display text-sm font-semibold text-navy-deep dark:text-white">Frame a decision</p>
      <input className="input" placeholder="Decision title — the question to be decided" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />
      <textarea className="input" placeholder="Context" rows={2} value={context} onChange={(e) => setContext(e.target.value)} />
      <textarea className="input" placeholder="Problem statement" rows={2} value={problem} onChange={(e) => setProblem(e.target.value)} />
      <textarea className="input" placeholder="Options considered (one per line)" rows={3} value={options} onChange={(e) => setOptions(e.target.value)} />
      <textarea className="input" placeholder="Recommendation" rows={2} value={recommendation} onChange={(e) => setRecommendation(e.target.value)} />
      <div className="grid gap-3 sm:grid-cols-3">
        <input className="input" placeholder="Financial implication" value={financialImplication} onChange={(e) => setFinancialImplication(e.target.value)} />
        <label className="block text-xs text-slate-500 dark:text-slate-400">
          Decision deadline
          <input type="date" className="input mt-1" value={decisionDeadline} onChange={(e) => setDecisionDeadline(e.target.value)} />
        </label>
        {subsidiaries.length > 0 && (
          <label className="block text-xs text-slate-500 dark:text-slate-400">
            Subsidiary
            <select className="input mt-1" value={subsidiaryId} onChange={(e) => setSubsidiaryId(e.target.value)}>
              <option value="">My scope</option>
              {subsidiaries.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? "Framing…" : "Submit to Decision Room"}</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

export function ApprovalDecide({ id, kind }: { id: string; kind: string }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function decide(decision: "approved" | "rejected") {
    setBusy(true);
    setError(null);
    const r = await post("/api/approvals", { id, decision, comment: comment || undefined });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Decision failed");
    router.refresh();
  }

  return (
    <div className="mt-2 space-y-2">
      <input className="input" placeholder="Decision note (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="flex gap-2">
        <button className="btn-primary !py-1.5" disabled={busy} onClick={() => decide("approved")}>Approve {kind}</button>
        <button className="btn-ghost !py-1.5 text-red-600 dark:text-red-400" disabled={busy} onClick={() => decide("rejected")}>Reject</button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export function AnnouncementPublish() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("group");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await post("/api/announcements", { title, body, audience });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Could not publish");
    setOpen(false);
    setTitle(""); setBody("");
    router.refresh();
  }

  if (!open) return <button className="btn-primary" onClick={() => setOpen(true)}>New announcement</button>;
  return (
    <form onSubmit={submit} className="card mb-5 space-y-3 p-4">
      <p className="font-display text-sm font-semibold text-navy-deep dark:text-white">Publish announcement</p>
      <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <textarea className="input" placeholder="Message" rows={4} value={body} onChange={(e) => setBody(e.target.value)} required />
      <label className="block w-fit text-xs text-slate-500 dark:text-slate-400">
        Audience
        <select className="input mt-1" value={audience} onChange={(e) => setAudience(e.target.value)}>
          <option value="group">Whole group</option>
          <option value="subsidiary">My subsidiary</option>
          <option value="department">My department</option>
        </select>
      </label>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? "Publishing…" : "Publish"}</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

export function MessageComposer({ channelId }: { channelId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    const r = await post("/api/messages", { channelId, body });
    if (!r.ok) return setError(r.error ?? "Could not send");
    setBody("");
    setError(null);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2">
      <textarea className="input" rows={2} placeholder="Write a message…" value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="flex items-center gap-3">
        <button className="btn-primary !py-1.5">Send</button>
        {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </form>
  );
}
