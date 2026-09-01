# IMS — System Architecture & Flow

Multi-store inventory management system, configurable for any product business.
Stack: **Next.js (App Router) + TypeScript + Supabase (Postgres/Auth/RLS) + Tailwind CSS + Framer Motion**, deployed on **Vercel**.

---

## 1. Request & Auth Flow

```
Browser request
  → middleware.ts
      ├─ refreshes Supabase session (session cookies — browser close = logout)
      ├─ no session + protected route → redirect /login
      └─ signed in + /login → redirect /
  → Server Component page
      ├─ requireUser() / requireAdmin() guard
      ├─ data via Supabase (RLS enforced at DB level)
      └─ renders HTML
Mutations (sales, settings, users…) = Server Actions
      └─ re-verify session/role → write → revalidatePath
```

## 2. RBAC — 4 Enforcement Layers

| Layer | What it does |
|---|---|
| 1. RLS policies | Managers locked to `profiles.store_id`; no `capital_ledger`, no COGS (`variant_public_view`), no product/batch writes, no cross-store access |
| 2. Middleware | Unauthenticated → `/login` |
| 3. Server guards | `requireUser()` / `requireAdmin()` on pages and actions |
| 4. UI | Admin links hidden; cost fields never render for managers |

Roles: `system_admin` (everything) / `store_manager` (own store: sell + stock).

## 3. Configuration System

```
app_settings (key/value — admins write, all signed-in read)
  ├─ business_name ─────────→ sidebar brand, tab title, logo letter
  ├─ currency_symbol/locale → every money display
  └─ size_unit ─────────────→ all size labels/inputs
product_categories (rows) → master taxonomy (slug/label/sort)
category_attribute_definitions → per-category variant attribute schema
product_variants.attributes (JSONB + GIN) → dynamic attribute values,
  validated by trg_validate_variant_attributes (declared keys + required)
stores.categories (text[]) → per-store subset (NULL = all)
```

- System panel lives at `/admin/config` (admins only) with the Taxonomy manager
- Cached taxonomy service (`src/lib/services/taxonomy.ts`, tag: `taxonomy`)
- Product/variant forms generate fields from the taxonomy at runtime;
  values persist to `variants.attributes` (legacy `concentration` dual-written)
- Sales form filters the variant dropdown to the selected store's categories

## 4. Data Model & Write Flows

**Catalog (global):** `products` → `product_variants` → `product_notes`, `batches`

**Inventory:** `stock_movements` (purchase/adjustment/wastage) → `apply_stock_movement`
trigger → `inventory_levels` (per store × variant). Append-only audit log.

**Selling:** `/sales` → `sales_transactions` + `sale_items` → `deduct_sale_stock`
trigger decrements inventory. Delete = admin-only.

**Capital (admin):** `capital_ledger` (in/out/allocation/expense).

**Users (admin):** `/users` → service-role `auth.admin.createUser` (random one-time
temp password, shown once) + profile row → user changes password in Settings.
Admin "Reset" sets `password123`. No email dependency.

**Dashboard:** single RPC `store_sales_summary_all` (RLS-invoker) + inventory/sales/
capital queries in one parallel batch → stat cards, 14-day chart, per-store table,
low-stock list.

## 5. Pages

| Route | Access | Purpose |
|---|---|---|
| `/login` | public | Sign in (theme toggle) |
| `/` | signed-in | Dashboard |
| `/sales` | signed-in | Record sale + history |
| `/inventory` | signed-in | Stock levels + movements |
| `/products`, `/products/[id]` | signed-in | Catalog, variants, notes, batches |
| `/stores` | admin | Stores + categories sold |
| `/users` | admin | Register/reset/disable users |
| `/capital` | admin | Capital ledger |
| `/admin/config` | admin | System settings + taxonomy (categories & attribute definitions) |
| `/settings` | signed-in | Profile, password (personal only) |

Navigation: floating glass sidebar (desktop) / bottom bar + More sheet (mobile).

## 6. Environments

| Env | Supabase | Notes |
|---|---|---|
| Local dev | project `xudkihdagubicbghroqj` | `.env.local` (gitignored) |
| Production | same project | Vercel env vars; domain `inventory.ronaldqa.dev` |

SQL migrations run in order: `001_schema` → `002_rls_policies` → `003_settings` →
`004_dashboard_rpc` → `005_category_options` → `006_store_categories` →
`007_dynamic_taxonomy_refactor` → `008_jsonb_attributes_backfill`.

## 7. Known Gaps

- Stock-in form (admin) not yet filtered by store categories
- Store categories are create-only (no edit UI yet)
- No forced password change on first login / after reset (`password123` default)
- Legacy columns (`products.concentration`, `product_variants.size_ml`, `category_options`) still populated — drop after QA pipeline (roadmap Phase 7)
- No E2E tests / CI / RLS regression tests yet
