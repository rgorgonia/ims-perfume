# Perfume IMS — Architecture Document

Companion to `perfume-ims-architecture-prompt.md`. Covers: (1) Database Schema (see `sql/001_schema.sql`), (2) RLS Strategy (`sql/002_rls_policies.sql`), (3) Dashboard API Architecture, (4) Admin Flow.

---

## 1. Database Schema — Design Rationale

| Decision | Why |
|---|---|
| `profiles` mirrors `auth.users` 1:1 | Supabase Auth owns credentials; `profiles` holds role + `store_id` assignment. |
| `inventory_levels` bridges `product_variants × stores × batches` | Same bottle can be 10 units in Store A and 5 in Store B; batch/lot tracked per level. |
| `stock_movements` is an append-only audit log | Trigger (`apply_stock_movement`) updates `inventory_levels` automatically — the level table is a derived cache, the log is the source of truth. |
| COGS snapshot on `sale_items.unit_cogs` / `sales_transactions.total_cogs` | Store profit is computable from sales data alone — managers never need to join to live `cost_price`. |
| `capital_ledger` is a separate admin-only table | Capital flows (investments, allocations, expenses) are never readable by managers. |
| `product_notes` normalized | Flexible tagging of top/heart/base notes (e.g. bergamot, sandalwood) per fragrance. |

---

## 2. Security & RLS Strategy

### 2a. Role resolution

```sql
is_system_admin()      -- boolean: profiles.role = 'system_admin'
assigned_store_ids()   -- setof uuid: manager's store_id + all stores if admin
```

Both are `security definer` so RLS policies can call them without recursion on `profiles`.

### 2b. Store isolation

Every table with a `store_id` uses one pattern:

```sql
store_id in (select public.assigned_store_ids())
```

Store managers literally cannot query another store's inventory, purchases, or sales — the database filters it out regardless of what the app requests.

### 2c. Insert sale for own store only

```sql
sale_insert:  with check (store_id in assigned_store_ids() AND sold_by = auth.uid())
sale_select:  using (store_id in assigned_store_ids())
sale_update:  admin-only   -- managers can't edit past sales
```

### 2d. Hiding COGS / capital from Store Managers (3 layers)

**Layer 1 — `capital_ledger`: admin-only via a single policy.** RLS denies all operations when no policy matches; only `ledger_admin_all` (admin) exists. Non-admins get zero rows on any query — invisible, not just hidden.

**Layer 2 — `product_variants.cost_price`:** managers need SKU/size/retail price to sell, so variant rows are readable, but manager-facing queries use `public.variant_public_view`, which omits the cost column. Only admin Server Components (server-side, never shipped to the browser) query `product_variants` directly.

**Layer 3 — COGS snapshots:** `sale_items.unit_cogs` is a per-sale snapshot readable within a manager's own store (needed for store-level profit display), but it's a dead-end value: there is no RLS path from it to `product_variants.cost_price`, to other stores' data, or to `capital_ledger`. Global profit rollups only exist in admin-only RPCs.

### 2e. Staff registration restricted to admin

`profiles` has `profile_admin_write` (admin-only) and `profile_self_read` — a manager cannot create, promote, or reassign anyone.

---

## 3. Next.js Dashboard API Architecture

Constraints: Vercel serverless (10s Hobby / 60s max timeout), avoid N+1 queries and heavy client-side aggregation.

### 3a. Server Components + RPC aggregation

Dashboards render in **Server Components** calling Supabase directly. Each widget maps to **one** Postgres function so the database does the math:

```ts
// app/(dashboard)/store/[id]/page.tsx — Server Component
const { data } = await supabase.rpc('store_sales_summary', { p_store: storeId, p_days: 30 });
// -> rows: { day, revenue, cogs, profit } — one round-trip, index-backed GROUP BY
```

RLS applies inside the RPC (`security invoker`), so a manager calling it for another store's ID simply gets empty results.

### 3b. Caching to dodge cold starts + timeouts

- `export const revalidate = 60` on dashboard pages (ISR) — functions aren't invoked on every request.
- `revalidateTag('sales-summary')` after sale mutations so figures refresh on next render.
- Admin global rollups (all stores): `revalidate = 300` — informational, not transactional.

### 3c. Capital remaining (admin)

`capital_remaining = SUM(capital_ledger.amount) + SUM(all stores' profit)` computed in a single admin-only RPC (`security definer`), cached, rendered only on admin routes.

### 3d. Heavy reports

- All aggregations hit the composite indexes (`idx_sales_store_time`, etc.) — sub-100ms at realistic volumes.
- CSV/PDF exports: stream via Route Handler (`ReadableStream`), or defer to background jobs (Inngest/Upstash) if they outgrow 60s.

---

## 4. Admin Flow — Registering Users & Assigning Stores

Supabase rule: an admin never creates another user's password client-side.

### Pattern A — Service-role API (recommended)

1. Admin fills the "Register Staff" form (name, email, role, store).
2. Route Handler `app/api/admin/register-staff/route.ts` verifies the caller's session role, then uses the **service role key** (server-only env var):

```ts
const { data: user } = await adminAuth.admin.createUser({
  email,
  email_confirm: true,
  password: crypto.randomUUID(),        // temp password, never shown to admin
  user_metadata: { full_name: name },
});
await adminDb.from('profiles').insert({ id: user.id, full_name: name, role, store_id });
```

3. Staff uses "Forgot password" on first login to set their own — the admin never handles real credentials.
4. Middleware + `profile_admin_write` RLS provide defense in depth if the endpoint is hit directly.

### Pattern B — Invitations

`adminAuth.admin.inviteUserByEmail(email)` sends a Supabase invite link; the user sets their own password. Same admin verification + `profiles` insert.

### Middleware sketch

```ts
// middleware.ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect('/login');
const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
if (p?.role !== 'system_admin') redirect('/store');  // managers never reach /admin routes
```

---

## 5. Deployment Notes (Vercel + Supabase)

1. Run `sql/001_schema.sql`, then `sql/002_rls_policies.sql` in the Supabase SQL editor.
2. Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and **server-only** `SUPABASE_SERVICE_ROLE_KEY`.
3. Import repo into Vercel → Settings → Domains → add `inventory.ronaldqa.dev` (free, SSL auto-provisioned — required for `.dev` HSTS).
4. Use Supabase's **connection pooler** string (port 6543, transaction mode) for serverless functions.


**Key design point:** managers **never** mutate `inventory_levels` directly. They insert `stock_movements` (adjustments, transfers); the trigger updates levels. This keeps the audit log complete and tamper-evident (`inv_admin_write` is admin-only).
