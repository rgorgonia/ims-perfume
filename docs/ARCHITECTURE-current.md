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

## 3. Configuration System (business-agnostic)

```
app_settings (key/value — admins write, all signed-in read; 1 deduped read/request)
  ├─ business_name ─────────→ sidebar brand, tab title, logo letter
  ├─ currency_symbol/locale → every money display
  ├─ size_unit ─────────────→ all size labels/inputs
  ├─ product_categories ───→ master category list (chip editor in Settings)
  ├─ category_options ─────→ per-category 2nd dropdown (e.g. Fragrance: EDT, EDP…)
  └─ perfume_features ─────→ toggles concentration/scent-note UI globally
stores.categories (text[]) → per-store subset of master list (NULL = all)
```

- Settings → System panel (admins only) edits all of the above
- Category-driven dropdown: picking a category on Add Product swaps the options client-side
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
| `/settings` | signed-in | Profile, password; System panel (admin) |

Navigation: floating glass sidebar (desktop) / bottom bar + More sheet (mobile).

## 6. Environments

| Env | Supabase | Notes |
|---|---|---|
| Local dev | project `xudkihdagubicbghroqj` | `.env.local` (gitignored) |
| Production | same project | Vercel env vars; domain `inventory.ronaldqa.dev` |

SQL migrations run in order: `001_schema` → `002_rls_policies` → `003_settings` →
`004_dashboard_rpc` → `005_category_options` → `006_store_categories`.

## 7. Known Gaps

- Stock-in form (admin) not yet filtered by store categories
- Store categories are create-only (no edit UI yet)
- No forced password change on first login / after reset (`password123` default)
- No E2E tests / CI / RLS regression tests yet
