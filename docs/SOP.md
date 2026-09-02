# Standard Operating Procedure — inventory.ronaldqa.dev (Multi-Tenant SaaS)

**Version 2.0** · Multi-tenant B2B SaaS · Roles: Platform Super Admin / Tenant Owner / Store Manager

---

## 1. Purpose & Architecture

inventory.ronaldqa.dev is a **multi-tenant SaaS platform**: independent retail businesses ("tenants") rent the system to manage their own stores, inventory, and sales.

- **Data isolation** — every data table carries a `tenant_id`. Row-Level Security (RLS) is the *absolute* source of truth: the database physically rejects cross-tenant reads and writes, even via direct API calls. UI hiding is only a convenience, never a control.
- **Event-sourced stock** — every purchase, adjustment, wastage, and sale creates an immutable `stock_movements` row. Current inventory is derived from these events.
- **Automated operations** — recording a sale runs through a single atomic database RPC (`record_sale`) that prices the sale, fills COGS, deducts stock, and rolls back entirely on failure (e.g. insufficient stock). No orphan records, no manual reconciliation.
- **Suspension** — a platform admin can suspend a tenant; `current_tenant_ids()` stops including it and *all* of its users lose DB access immediately.

## 2. Roles (RBAC)

| Role | Scope | Can do | Sees revenue/cost? |
|---|---|---|---|
| **Platform Super Admin** | All tenants (global) | Provision/suspend tenants, manage owners & platform config, view platform audit log, god-mode data access | ✔ All |
| **Tenant Owner** | Own tenant only | Create stores, manage catalog & taxonomy, invite/assign store managers, view own revenue/profit/capital | ✔ Own tenant |
| **Store Manager** | Assigned store only | Record sales and stock movements for their store | ✘ Never — sales counts only; cost price is physically unreadable (column grants) |

**Cost price rule:** `cost_price` is excluded from column grants for regular users and never appears in the sales/inventory UIs. COGS is filled by SECURITY DEFINER triggers only.

## 3. Journey A — Platform Super Admin: provisioning a tenant

1. Sign in → **Tenants** (sidebar, platform admins only).
2. *Provision a new tenant*: business name, owner name + email, optional first store → **Create tenant**.
   - The system creates the tenant, the owner's account (auto-confirmed), and the store atomically. Any failure rolls everything back.
3. **Copy the one-time temp password** and share it securely with the owner. The owner changes it after first sign-in (Settings → password form) or via "Forgot password?" on the login page.
4. To freeze a renter (e.g. non-payment): **Suspend** on their row → confirm. Access dies instantly at the DB level; re-activate the same way.
5. **Audit log** (sidebar) shows every stock movement across all tenants, paginated, with tenant/store/product attribution.

## 4. Journey B — Tenant Owner: setting up the business

1. Sign in with the temp password → change it under **Settings**.
2. **Stores & Config** → create stores (name, address, type, categories sold).
3. **Stores → Configuration** → define your taxonomy: product categories and attributes (concentration, scent notes, etc.). These drive the product and sale forms for all your stores.
4. **Users** → register store managers, assign each to a store. Managers see sales/stock for their store only — never financials.
5. **Products** → add products with at least one variant (SKU + size + retail price; cost price owner-only). *A product without a variant does not appear in Inventory or Sales.*
6. **Capital** → record capital in/out, allocations, and expenses.

## 5. Journey C — Store Manager: daily operations

1. Sign in. The header shows your tenant and assigned store context.
2. **Inventory** → record stock: purchase (stock in), adjustment (correction), wastage (removal). Stock can never go negative.
3. **Sales** → record a sale: pick variant (shows units available; out-of-stock variants disabled), quantity (capped), payment method, optional discount.
   - Stock deducts automatically; overselling is blocked with *"Insufficient stock — only N available."*
4. Dashboard shows your sales **count**; revenue/profit are not displayed to managers by design.

## 6. Error states & recovery

| Situation | What you see | What to do |
|---|---|---|
| Oversell attempt | "Insufficient stock — only N available" | Record a purchase first |
| Variant with no stock at store | "…no stock at this store" | Purchase stock for that store |
| Accessing another tenant's store | "You don't have access to that store" | Confirm store selection; ask owner to assign you |
| Inactive variant | "That product is not available" | Owner re-activates or adds a variant |
| No products in sales form | "No variant yet — add one" | Owner adds a variant to the product |
| Suspended tenant | Login succeeds but all data queries are empty/blocked | Contact the platform admin |
| Forgotten password | — | "Forgot password?" on the login page |

## 7. Security invariants (what the database enforces)

1. Every read/write on tenant data is filtered by `tenant_id ∈ current_tenant_ids()`.
2. Store managers are limited to their assigned `store_id`.
3. Store managers cannot read `cost_price`, `unit_cogs`, `total_cogs`, revenue, or capital.
4. Sale pricing is computed server-side; a tampered client cannot set its own price.
5. Stock cannot go negative; the sale RPC is atomic (all-or-nothing).
6. Tenant suspension revokes access immediately, at the RLS layer.

## 8. End-of-shift checklist (store staff)

1. All sales recorded in **Sales** (verify in Recent sales).
2. **Inventory** stock-on-hand matches physical counts for fast movers.
3. Wastage/damages recorded.
4. Owner: cross-check Dashboard revenue vs collected payments; log the day's cash under **Capital**.

---

*Review this SOP whenever roles, routes, or stock logic change. Last reviewed: 2026-09-02.*
