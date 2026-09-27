# Ascendium One

**One institution. One intelligence layer. One operating system.**

Ascendium One is the institutional operating system for **Ascendium Global Holdings (AGH)** — the holding company founded by **Group CEO & Founder Leon Kayanda** — spanning one holding company, five clusters (Finance, Knowledge, Infrastructure, Technology, Frontier), and 19 enterprises.

![Ascendium Global Holdings](public/brand/ascendium-logo.png)

## What it does

- **Group Command Centre** — institutional health for the full AGH ecosystem: enterprises, people, projects, approvals.
- **Ascendium Pulse** — the institutional health layer: people workload, risk exposure, governance & decisions, technology & security.
- **Ascendium Morning Brief** — a daily, role-scoped briefing of what requires the executive's attention.
- **Ascendium Map** — the interactive organisational graph of AGH.
- **Ascendium Command** — universal search bar + Ask Ascendium Intelligence (local, deterministic retrieval engine).
- **Decision Room, risk register, KPIs, documents, tasks, projects, approvals, announcements, notifications, audit trail** — all role-scoped.
- **Server-enforced RBAC** — every query is scoped to the signed-in user's authorised organisational level (own → department → subsidiary → group). Users cannot reach data outside their scope via URL or API manipulation; violations return a 403 boundary and are audit-logged.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router), React 19, TypeScript strict |
| Styling | Tailwind CSS v3 (dark mode), responsive + PWA-ready |
| ORM / DB | Prisma 6 — SQLite by default, Postgres-compatible schema |
| Auth | bcryptjs password hashing, DB sessions (httpOnly cookie `ao_session`, 12 h TTL) |
| AI | Ascendium Intelligence — local deterministic retrieval engine with a provider abstraction |

## Quick start (local)

```bash
npm install
npm run setup      # prisma generate + db push + seed (AGH structure + labelled demo data)
npm run dev        # http://localhost:3100
```

Production:

```bash
npm run build
npm start          # http://localhost:3100
```

## Quick start (Docker)

```bash
docker compose up --build
# http://localhost:3100 — database is seeded on first start
```

## Demo accounts

All demonstration accounts use the password `Ascendium#Demo1`:

| Role | Email |
| --- | --- |
| Group CEO & Founder | `leon.kayanda@ascendium.local` |
| Group administrator | `admin@ascendium.local` |
| Employee (scoped access) | `rosa.uche@ascendium.local` |

## Demo data

Every record in the seeded environment is synthetic and labelled — `[DEMO]` inline tags and `DEMO DATA` badges throughout the UI. It is **not** real financial, employee, or operational data and must never be presented as such.

## Security model

- Permissions are `resource:action:level` grants held on roles; the engine resolves the highest applicable level per request (`src/lib/auth.ts`).
- `scopeWhere` (`src/lib/rbac.ts`) translates that level into a Prisma `where` fragment so scoping happens in the database query, not the UI.
- `ForbiddenError` carries `status = 403` and a production-stable `digest = "FORBIDDEN"` that survives Next.js client-boundary serialization, so the 403 panel renders reliably in production.
- Security headers (CSP, X-Frame-Options, nosniff, Referrer-Policy) are set in `next.config.mjs`.

## Tests

```bash
npm test           # vitest — RBAC permission resolution + scope-isolation rules (18 tests)
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server on port 3100 |
| `npm run build` | `prisma generate` + production build |
| `npm start` | Production server |
| `npm test` | Vitest suite |
| `npm run setup` | Generate client, push schema, seed |
| `npm run db:reset` | Force-reset the database and reseed |

## Layout

```
prisma/            schema + seed (AGH org structure, clusters, 19 subsidiaries, demo data)
src/app/           App Router pages + API routes
src/lib/           auth, RBAC/scope engine, domain constants, Ascendium Intelligence
src/components/    shell, dashboards, Ascendium Command, cards
tests/             vitest — RBAC + scope isolation
```
