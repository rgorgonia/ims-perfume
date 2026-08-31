# Perfume IMS — User Guide

A multi-store inventory management system for your perfume business, built on
Next.js + Supabase. This guide covers setup, accounts, every page, and the
day-to-day workflows.

---

## 1. First-time setup (Admin)

1. **Supabase project** — create one at [supabase.com](https://supabase.com).
2. **Database schema** — in the Supabase SQL Editor run, in order:
   - `sql/001_schema.sql` (tables, triggers, functions)
   - `sql/002_rls_policies.sql` (row-level security)
3. **Environment variables** — copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Settings → API)
   - `SUPABASE_SERVICE_ROLE_KEY` — **server-only**, never commit or prefix with `NEXT_PUBLIC_`
4. **First admin account** — Supabase Dashboard → Authentication → Users →
   Add user (email + password, auto-confirm), then promote in the SQL Editor:
   ```sql
   update public.profiles set role = 'system_admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
5. **Run the app** — `npm run dev` → open `http://localhost:3000/login`.

---

## 2. Roles — who can do what

| | Store Manager | System Admin |
|---|---|---|
| Dashboard | Own store only | All stores + capital position |
| Record sales | ✅ own store, as themselves | ✅ any store |
| Stock movements (in/adjust/waste) | ✅ own store | ✅ any store + batches |
| Products / variants / notes / batches | Read-only | ✅ full control |
| Stores page | ❌ | ✅ |
| Users page (register staff) | ❌ | ✅ |
| Capital ledger | ❌ invisible (RLS) | ✅ |
| See wholesale cost (COGS) | ❌ never | ✅ |

Enforcement is layered: database RLS (the real wall) → middleware (login
required) → server-side page guards → UI hiding. A manager cannot reach
another store's data even with a hand-crafted API request.

---

## 3. The pages

### `/login` — Sign in
Email + password via Supabase Auth. Wrong credentials show an inline error.
New users registered by an admin receive a temporary password they never see;
they should use "Forgot password" to set their own. Theme toggle (🌙/☀️) is in
the navbar once signed in; the choice is remembered.

### `/` — Dashboard
- **Stat cards**: 30-day revenue, 30-day gross profit, low-stock count, and
  (admins) total capital position.
- **Daily revenue chart**: bar chart of the last 14 days (hover a bar for the
  exact amount).
- **Store performance table**: revenue, profit, and margin % per store for the
  last 30 days — computed by the `store_sales_summary` database function.
- **Low stock list**: items at/below their variant's low-stock threshold.
- **Recent sales**: the last 8 transactions.
- **Sign out** button in the header.

### `/sales` — Record sale
Pick store, product variant, quantity, payment method (cash / GCash / card /
bank transfer), and optional discount. Saving writes a sales transaction +
line item; a database trigger **automatically deducts inventory** and snapshots
the COGS so profit is computable without exposing wholesale prices.
Recent sales are listed below the form.


### `/inventory` — Stock control
- **Stock on hand table**: quantity per variant per store (aggregated across
  batches). Low quantities are highlighted amber. Managers see only their store.
- **Record stock movement**:
  - **Purchase** — stock arrives (adds quantity). Admins may also attach a
    batch lot number + expiry date.
  - **Adjustment** — corrections, may be positive or negative (e.g. `-2`).
  - **Wastage** — damaged/expired/lost stock (always subtracts; enter the
    amount lost as a positive number).
- Inventory updates instantly via the `stock_movements` trigger — this also
  feeds the dashboard's low-stock widget.

### `/products` — Catalog
List of all fragrances with brand, concentration, variants, and retail price.
Click a product name to open its detail page. Admins can create new products
here (including the first variant and — admin-only — the cost price).

### `/products/[id]` — Product detail
- **Variants**: add sizes/types (30ml, 50ml, tester, gift set…) with SKU,
  retail price, and low-stock threshold.
- **Scent profile**: tag top / heart / base notes (e.g. bergamot, sandalwood).
  Click a note chip to remove it.
- **Batches / lots**: lot numbers with expiry dates; expired batches show red.
  Batches pair with stock-in on the Inventory page (admin).

### `/stores` — Store management (admin)
List all stores and create new ones (name + optional address).

### `/users` — Staff registration (admin)
- **Register user**: full name, email, role (Store Manager / System Admin),
  and store assignment (managers only). A temporary password is generated
  server-side — the new user should use "Forgot password" on the login page
  to set their own.
- **All users table**: enable/disable accounts (you cannot disable yourself).

### `/capital` — Capital ledger (admin, hidden from managers)
- **Balance** shown in the header (green positive / red negative).
- **Add entry**: capital in (investment), capital out (withdrawal),
  store allocation, or expense — with optional store targeting, amount,
  and description. The sign is applied automatically by entry type.
- Entries feed the "Capital position" card on the dashboard.

---

## 4. Everyday workflows

### Setting up a new store (admin)
`/stores` → create store → `/products` add products → `/inventory` record a
**purchase** to fill stock → `/users` register the Store Manager assigned to
that store → they log in (reset temp password) and start selling.

### Daily selling (manager)
Log in → `/sales` → record each transaction. Stock deducts automatically;
watch `/inventory` for anything going low.

### Replenishing stock
`/inventory` → record a **purchase** movement (with lot number + expiry if
admin). For damaged goods use **wastage**; for stock-count corrections use
**adjustment**.

### Tracking money (admin)
`/capital` → record investments, store allocations, and expenses. The
dashboard shows total capital position alongside 30-day revenue and profit.

---

## 5. Troubleshooting

| Problem | Fix |
|---|---|
| "Could not find the table" errors | Schema not run — run both SQL files in order |
| Login fails with correct password | User not auto-confirmed, or no `profiles` row exists |
| Admin pages redirect me away | Your `profiles.role` is not `system_admin` — promote via SQL |
| "SUPABASE_SERVICE_ROLE_KEY is not set" on `/users` | Add the key to `.env.local` and restart the dev server |
| Dashboard shows ₱0.00 | No sales in the last 30 days — record one under `/sales` |
| Stock didn't change after a sale | Sale items deduct via trigger; verify an `inventory_levels` row exists for that variant + store |

---

## 6. Developer notes

- **Stack**: Next.js 15 (App Router, Server Actions), TypeScript, TailwindCSS, Supabase (`@supabase/ssr`).
- **Security model**: see `docs/ARCHITECTURE.md` — RLS is the source of truth;
  the app adds middleware + server guards + UI filtering on top.
- **Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the client or commit env files.
- Schema changes go in `sql/` and are applied via the Supabase SQL Editor.
