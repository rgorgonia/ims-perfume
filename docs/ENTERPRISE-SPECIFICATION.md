# Multi-Tenant IMS — Enterprise System Architecture & Engineering Specification

**Version:** 2.0 (Target Architecture)
**Status:** Approved specification — migration roadmap in §11
**Pattern:** Decoupled, Metadata-Driven, Serverless Edge
**Audience:** Engineering, DevOps, Security Review

This document supersedes the v1 draft. It refactors the system into an
enterprise-grade, domain-agnostic platform. Sections marked **[TARGET]** define
the end-state architecture; sections marked **[MIGRATION]** define the concrete
path from the current implementation.

---

## 1. Executive Summary

The platform is a multi-tenant, multi-store Inventory Management System built on
a serverless edge topology. It is **domain-agnostic by construction**: no retail
vertical (fragrance, apparel, grocery) is encoded in the schema. All
domain-specific behavior is generated at runtime from a **Dynamic Attribute
Schema Engine** backed by PostgreSQL `JSONB` and a declarative
`category_attribute_definitions` table.

Core invariants enforced by this specification:

1. **Tenant isolation is a database guarantee** (RLS), never an application promise.
2. **Stock mutation is event-sourced** — `inventory_levels` is a derived
   projection; the append-only `stock_movements` ledger is the sole write path.
3. **Configuration is hierarchical and versioned** — global platform settings,
   tenant (store) overrides, and taxonomy metadata live in dedicated, indexed
   structures with explicit precedence rules.
4. **Every environment is isolated** — no shared database across dev, staging,
   and production.

---

## 2. Technology Stack & Infrastructure

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| Application | Next.js (App Router), React Server Components, Server Actions | Edge-first rendering, colocated mutation logic, zero-API-drift |
| Language | TypeScript (strict) | End-to-end type safety from schema to UI |
| Data & Auth | Supabase (PostgreSQL 15+, GoTrue Auth, PostgREST, PL/pgSQL) | Managed auth, RLS-native multi-tenancy, trigger-based invariants |
| Presentation | Tailwind CSS, Framer Motion, Radix UI primitives | Accessible headless components, consistent design tokens |
| Compute | Vercel Edge Middleware + Serverless Functions | Session validation before compute allocation |
| Config cache (future) | Vercel Edge Config / KV | Cold-start-free global settings reads (§5.4) |

**Deployment targets:** Local (dev) → Staging (`ims-staging`) → Production
(`ims-prod`). See §9.

---

## 3. Architecture Topology & Request Lifecycle

Unidirectional data flow; authentication is resolved at the edge **before**
compute is allocated.

```text
[ Client ]
    │ HTTPS (TLS 1.3)
    ▼
[ Edge Layer — Next.js Middleware ]
    ├─ Session cookie refresh (GoTrue)
    ├─ JWT validation (reject malformed/expired before compute)
    ├─ Route classification: public │ protected │ admin
    │        │                                   │
    │  authorized                       unauthorized/missing JWT
    ▼                                            ▼
[ Compute Layer — RSC / Server Actions ]      302 → /login
    ├─ Route guards: requireUser() / requireAdmin()
    ├─ Mutation guards: claim re-verification inside every Server Action
    ▼
[ Data Access — Supabase client (anon JWT, never service-role on user paths) ]
    ▼
[ PostgreSQL — RLS evaluation as final authority ]
    ▼
[ Tables │ Views │ RPCs │ Triggers ]
```

**Mutation contract.** Every Server Action MUST: (1) resolve the caller's JWT
via `auth.getUser()` (never `getSession()` — the latter trusts client cookies),
(2) re-assert role claims against `profiles`, (3) perform the write, (4) emit
`revalidatePath()` for affected routes. Service-role keys are confined to the
user-provisioning module and are never exposed to user-initiated request paths.

---

## 4. Security Architecture — Defense in Depth (4 Layers)

RBAC follows the Principle of Least Privilege. Each layer is independently
auditable; no layer trusts the one above it.

| # | Layer | Mechanism | Guarantee |
| :- | :--- | :--- | :--- |
| 1 | **Edge** | Next.js Middleware — session/JWT validation, route classification | No unauthenticated request reaches compute |
| 2 | **Compute** | Server Component route guards (`requireUser`, `requireAdmin`) | No mis-rendered page; role checked server-side per route |
| 3 | **Mutation** | Server Actions re-verify claims before any write | Direct action invocation cannot escalate privileges |
| 4 | **Database** | PostgreSQL RLS — the hard tenant boundary | Even a compromised app tier cannot read/write across tenants |

### 4.1 Role Model

| Role | Scope |
| :--- | :--- |
| `system_admin` | Global: catalog, taxonomy, configuration console, user provisioning, capital ledger, all tenants |
| `store_manager` | Tenant-scoped: POS, local stock movements, local inventory read — strictly bound to `profiles.store_id` via RLS predicates |

### 4.2 RLS Invariants (non-negotiable)

1. Every multi-tenant table enables RLS with `using` **and** `with check` predicates.
2. Manager predicates resolve through a single `SECURITY DEFINER` helper
   (`current_store_ids()`), keeping policy logic in one auditable place.
3. `capital_ledger` and any cost-bearing column are invisible to managers at the
   row level; manager-facing reads use column-projected views
   (`variant_public_view`) that physically omit COGS.
4. Writes that must be admin-only (`batches`, `products`, `app_settings`,
   `category_attribute_definitions`) carry `with check (is_system_admin())`.

### 4.3 Authentication Hardening

- Session cookies are session-scoped (no persistent `maxAge`) — browser close
  terminates the session.
- **[TARGET]** Mandatory first-login credential rotation (§10.3).
- Service-role operations are logged to an admin audit table with actor,

---

## 5. Configuration Architecture — Redesigned

### 5.1 Problems with the v1 Flat Store

The v1 `app_settings` key/value table conflated four concerns: platform
branding, financial formatting, business taxonomy, and feature flags. It scaled
poorly because (a) values were untyped strings, (b) taxonomy lived in
comma-serialized text, (c) per-tenant overrides had no home, and (d) every
config change invalidated the whole app cache.

### 5.2 [TARGET] Three-Tier Configuration Hierarchy

| Tier | Store | Owner | Examples |
| :--- | :--- | :--- | :--- |
| **L1 — Platform** | `platform_settings` (typed columns, single row) | System admin | Business name, currency, locale, feature flags |
| **L2 — Taxonomy** | `product_categories` + `category_attribute_definitions` (dedicated tables) | System admin | Category tree, per-category attribute schemas |
| **L3 — Tenant** | `stores` typed columns | System admin (per store) | Category allowlist, store-specific overrides |

**Precedence rule:** L3 overrides L2 scoping; L1 provides defaults. Resolution
happens in one SQL function (`resolve_effective_config(store_id)`) so the
precedence is testable, not app logic.

### 5.3 [TARGET] Schema

```sql
-- L1: typed, single-row — no key/value strings
create table platform_settings (
  id int primary key default 1 check (id = 1),   -- enforced singleton
  business_name text not null,
  currency_code char(3) not null default 'PHP',
  currency_symbol text not null default '₱',
  locale text not null default 'en-PH',
  feature_flags jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- L2: taxonomy as first-class rows (replaces comma-separated strings)
create table product_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,            -- 'fragrance'
  label text not null,                  -- 'Fragrance'
  parent_id uuid references product_categories(id),  -- optional nesting
  sort_order int not null default 0,
  is_active boolean not null default true
);

-- L2: declarative attribute schema per category (§6)
create table category_attribute_definitions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references product_categories(id) on delete cascade,
  key text not null,                    -- 'concentration'
  label text not null,                  -- 'Concentration'
  input_type text not null check (input_type in ('select','text','number','boolean','date')),
  options jsonb,                        -- ["EDT","EDP",…] for select inputs
  required boolean not null default false,
  sort_order int not null default 0,
  unique (category_id, key)
);

---

## 6. Dynamic Attribute Schema Engine (Domain Agnosticism)

### 6.1 Deprecation Mandate

These v1 artifacts are domain-coupled and **deprecated**:

| v1 artifact | Replacement |
| :--- | :--- |
| `product_categories` comma string in `app_settings` | `product_categories` table (§5.3) |
| `category_options` JSON map | `category_attribute_definitions` (§6.2) |
| `product_variants.size_ml` (fragrance-only) | `attributes->>'size'` + unit declared in the attribute definition |
| `products.concentration` column + `concentration_type` enum | attribute `concentration` (already free-text since v1 migration 005) |
| `product_notes` (top/heart/base) | `multi_select` attribute declared by any category that wants it |
| `perfume_features` global flag | Obsolete — the UI renders exactly the attributes each category declares |

### 6.2 [TARGET] Engine Design

Every category declares the attributes its products must carry. Attribute data
lives in JSONB — no schema changes per vertical, ever.

```sql
alter table product_variants add column attributes jsonb not null default '{}';
alter table products         add column attributes jsonb not null default '{}';
```

**Integrity contract** — a `BEFORE INSERT OR UPDATE` trigger on
`product_variants` / `products`:

1. Loads `category_attribute_definitions` for the row's category.
2. Rejects keys that are not defined (strict mode) — prevents garbage attributes.
3. Validates `required` attributes are present.

---

## 7. Event-Driven Ledger & Data Models

### 7.1 Immutable Stock Ledger (Invariant)

`stock_movements` is an **append-only, immutable** ledger. Direct `UPDATE`/
`DELETE` on `inventory_levels` is forbidden and technically blocked:

```sql
create or replace function forbid_direct_stock_write()
returns trigger language plpgsql as $$
begin raise exception 'inventory_levels is a derived projection; write stock_movements instead'; end $$;

create trigger inventory_levels_no_direct_write
  before update or delete on inventory_levels
  for each row execute function forbid_direct_stock_write();
```

All stock changes flow through `stock_movements` (`purchase`, `adjustment`,
`wastage`, `transfer_out`, `transfer_in`), and the `apply_stock_movement`
trigger aggregates totals into `inventory_levels` (composite key
`store_id` × `variant_id`) atomically. An `immutable` flag on migrations locks
historical rows (update policies restricted to `false`).

### 7.2 Financial & Sales Domain

- **POS:** `sales_transactions` + `sale_items` (COGS snapshot at sale time).
  `deduct_sale_stock` trigger emits the stock event; sale deletion is
  admin-only and cascade-restricted.
- **Capital:** `capital_ledger` — strictly `system_admin` RLS.
- **Audit (new):** `admin_audit_log` (actor, action, target, diff jsonb) written
  by provisioning/config actions for forensic traceability.

### 7.3 Catalog Domain

`products` → `product_variants` (JSONB attributes) → `batches`
(lot/expiry, admin-written). Manager reads use column-projected views
(`variant_public_view`) that omit COGS.

---


---
## 8. Performance, Indexing & Aggregation

| Control | Detail |
| :--- | :--- |
| **GIN on JSONB** | `create index idx_variants_attributes on product_variants using gin (attributes jsonb_path_ops);` — accelerates containment queries (`@>`) for attribute-filtered catalogs |
| **Composite FK indexes** | `inventory_levels(store_id, variant_id)`, `stock_movements(store_id, created_at)`, `sales_transactions(store_id, created_at desc)` — all dashboard/RPC paths are index-only scans |
| **Materialized daily rollup** | `daily_sales_rollup` materialized view: `(store_id, day, revenue, cogs, profit)`, refreshed concurrently on a 5-minute schedule (`pg_cron`) — dashboards stop scanning transactions entirely |
| **RPC aggregation** | `store_sales_summary_all(p_days)` (RLS-invoker) reads the rollup, not raw transactions; single round-trip per dashboard render |
| **Request deduplication** | React `cache()` on settings/config reads — one query per request across layout + pages |
| **Edge delivery** | L1 settings mirrored to Edge Config (§5.4); static assets and RSC payloads cached at the edge |

---

## 9. Multi-Environment Isolation

| Environment | Supabase project | Vercel | Data policy |
| :--- | :--- | :--- | :--- |
| **Local dev** | `ims-dev` | `vercel dev` | Synthetic seed data; free-tier project |
| **Staging** | `ims-staging` | Preview + Staging env | Anonymized copy of prod (PII-scrubbed) refreshed monthly |
| **Production** | `ims-prod` | Production env (`inventory.ronaldqa.dev`) | Live data; PITR backups enabled |

**Rules:**

1. Each project has its own keys; env vars are never copied across environments.
2. Migrations run via a versioned, ordered script directory (`migrations/NNN_*.sql`)
   applied by CI to dev → staging → prod, never by hand in prod.
3. Staging must have identical RLS and trigger definitions — RLS regression tests
   (§10.4) run against staging on every deploy.
4. **[MIGRATION]** Current single shared project (`xudkihdagubicbghroqj`) is
   split: create `ims-prod`, run migrations 001–006 + seed production data,
   flip Vercel env vars, then repurpose the existing project as `ims-dev`.

4. Coerces values per `input_type` (number / boolean / text).

**Rendering contract** — forms are generated, never hardcoded:

```
category selected
  → SELECT key, label, input_type, options
    FROM category_attribute_definitions
    WHERE category_id = $1 ORDER BY sort_order
  → render via React input-component map (select/text/number/boolean/date)
  → submit { attributes: { key: value } } → trigger validates
```

The v1 "second dropdown" becomes simply the `select`-type definitions of the
chosen category; switching categories swaps generated fields client-side.
Adding "Beverage → Serving: Hot, Iced" is an INSERT, not a release.

### 6.3 Querying JSONB

- Containment: `attributes @> '{"concentration": "EDP"}'`
- Extraction: `attributes->>'size'`
- Indexing: GIN (§8.1).


-- L3: tenant overrides (NULL = inherit master taxonomy)
alter table stores
  add column category_allowlist uuid[] references product_categories(id);
```

### 5.4 Configuration Delivery & Caching

- Reads are served through a **request-scoped React cache** (v1 behavior,
  retained) so layout + page share one query.
- **[TARGET]** L1 platform settings mirror to **Vercel Edge Config** on write
  (post-mutation hook), giving edge-cached branding/locale with no DB round-trip
  on cold starts. Taxonomy (L2) remains a DB read — it changes rarely and
  benefits from RLS-aware joins.
- Writes to any config table bump a `config_version`; `revalidatePath('/','layout')`
  invalidates affected routes.

### 5.5 Configuration UI Isolation

Configuration management is **removed from the daily-operations surface** and
consolidated into a dedicated admin console:

```
/admin/config              → single entry point (admin-only, guarded)
    ├─ /branding           → L1 platform settings
    ├─ /taxonomy           → L2 categories + attribute schema builder
    └─ /tenants/[storeId]  → L3 per-store allowlist & overrides
```

- `/settings` reverts to **user-personal settings only** (profile, password,
  theme) — operations staff never see config controls.
- The console is a distinct route segment with its own layout, guarded by
  `requireAdmin()`, linked only from the admin dropdown — never in the
  manager-facing nav tree.
- **[MIGRATION]** The current `/settings` System panel relocates here verbatim
  in Phase 1 (§11) before the schema migration.


---

## 10. Technical Debt & Risk Remediation (Concrete Fixes)

### 10.1 Tenant-Scoped Category Filtering — Administrative Stock-In

**Current:** the admin stock-in form lists all variants regardless of the target store's allowlist.
**Fix:** extract the sale form's proven pattern into a shared `<VariantPicker storeId={…} />` client component that receives `stores.category_allowlist` (joined to variant → product.category) and filters identically in `/sales` and `/inventory`. Validation parity: the stock-in Server Action re-verifies the chosen variant's category against the target store's allowlist before inserting the movement (defense in depth — the UI filter alone is insufficient). **Estimate: 0.5 day.**

### 10.2 Store-Category Mapping — Full CRUD

**Current:** allowlist is set at store creation only.
**Fix:** extend the `/admin/config/tenants/[storeId]` console with an edit form (checkbox list of the master taxonomy, persisted via a guarded Server Action performing `update stores set category_allowlist = $1`). Include an "Affects N products currently hidden/shown" preview and an audit-log entry. Row-level policy: admin-only write, unchanged. **Estimate: 0.5 day.**

### 10.3 Mandatory First-Login Password Rotation

**Current:** admin-provisioned users (and resets) receive a known static password (`password123`) that users may never change.
**Fix (claims-based — more testable than Auth triggers):**

1. `profiles.must_change_password boolean not null default true`.
2. Admin provisioning and the Reset action set the temp password **and** `must_change_password = true`.
3. Middleware reads the claim from the session's profile fetch: when true, every route except `/settings/security` redirects there.
4. `/settings/security` password-change action clears the flag in the same transaction as the `auth.updateUser` call.
5. Optional hardening: revoke the session on reset so the temp password grants exactly one login. **Estimate: 1 day.**

### 10.4 Quality Assurance Pipeline

| Suite | Tooling | Gate |
| :--- | :--- | :--- |
| RLS regression | pgTAP or a Node test harness with three JWT personas (admin / manager-A / manager-B) asserting: cross-store reads return 0 rows, capital ledger invisible to managers, COGS absent from manager projections, admin-only write policies reject managers | Every PR (CI) |
| E2E | Playwright — login flow, POS sale → inventory decrement, provisioning → first-login rotation, config change → UI reflect | Every PR (staging) |
| Type & build | `tsc --noEmit` + `next build` | Every PR |
| Deploy | Vercel preview per PR → staging promotion → manual prod approval | Pipeline |

CI runs migrations against an ephemeral Postgres (Supabase CLI local stack) so RLS/trigger definitions are validated on every commit.

---

## 11. Migration Roadmap (Current → Target)

| Phase | Scope | Notes |
| :--- | :--- | :--- |
| **1. Re-house config UI** | Move System panel → `/admin/config`; `/settings` becomes personal-only | No schema change; unblocks daily-ops decluttering immediately |
| **2. Environment split** | Create `ims-prod`; flip Vercel env vars; repurpose old project as `ims-dev` | Enables safe testing of destructive phases |
| **3. First-login rotation** | §10.3 (profiles flag + middleware redirect) | Closes the `password123` exposure |
| **4. Store CRUD + stock-in filter** | §10.1, §10.2 | Completes tenant scoping |
| **5. Taxonomy tables** | Introduce `product_categories` + `category_attribute_definitions`; backfill from `app_settings` strings; dual-read during transition | Strangler-fig: v1 config still served until Phase 6 |
| **6. JSONB attributes** | Add `attributes` columns + validation trigger; backfill `size_ml`/`concentration`/notes into attributes; generate forms from definitions; drop deprecated columns | Requires brief write-freeze or careful dual-write |
| **7. QA pipeline** | §10.4 suites live in CI | Required before Phase 6 drops legacy columns |
| **8. Performance** | Materialized rollup + GIN indexes + Edge Config mirror | Any time after Phase 5 |

**Definition of Done (GA):** all four risk items closed, environment isolation complete, taxonomy/attributes migrated, E2E + RLS suites green in CI.

  action, and target (§10.4).
