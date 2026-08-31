# System Architecture & Engineering Specification
**Project:** Multi-Tenant Inventory Management System (IMS)
**Architecture Pattern:** Decoupled, Metadata-Driven, Serverless Edge

This document outlines the architectural topology, security model, data domains, and deployment strategy for the multi-store Inventory Management System. The platform is designed to be domain-agnostic, supporting diverse retail verticals through dynamic configuration.

---

## 1. Technology Stack & Infrastructure

*   **Application Framework:** Next.js (App Router) utilizing React Server Components (RSC) and Server Actions for optimized data fetching and mutation.
*   **Language:** TypeScript (Strict Mode) for end-to-end type safety.
*   **Database & Auth (BaaS):** Supabase (PostgreSQL 15+, GoTrue Auth, PL/pgSQL RPCs, and Triggers).
*   **Presentation Layer:** Tailwind CSS, Framer Motion, Radix UI (Headless primitives).
*   **Compute & Edge Hosting:** Vercel (Edge Middleware, Serverless Functions).

---

## 2. Architecture Topology & Request Lifecycle

The system utilizes a unidirectional data flow and enforces authentication strictly at the edge before allocating serverless compute resources.

```text
[ Client Application ]
       │
       ▼ (HTTPS / TLS 1.3)
[ Edge Layer: Next.js Middleware ] ────(Session Validation)────┐
       │                                                       │
       ▼ (Authorized)                                    (Unauthorized / Missing JWT)
[ Compute Layer: Next.js RSC / Server Actions ]                │
       │                                                       ▼
       ├─▶ Authorization Guard (requireUser / requireAdmin)    Redirect to /login
       │
       ▼ (Supabase Client / PostgREST)
[ Data Layer: Supabase / PostgreSQL ]
       │
       └─▶ Row-Level Security (RLS) Evaluation ──▶ [ Database Read/Write ]
```

*   **Mutations:** Executed exclusively via Next.js Server Actions. Each action re-verifies the session, enforces role-based constraints, executes the transaction, and triggers cache invalidation via `revalidatePath()`.


---

## 3. Security Architecture (Defense in Depth)

Role-Based Access Control (RBAC) is implemented via the Principle of Least Privilege (PoLP) across four distinct, isolated layers.

| Enforcement Layer | Mechanism | Implementation Scope |
| :--- | :--- | :--- |
| **1. Database (RLS)** | PostgreSQL Row-Level Security | Hard boundary. `store_manager` requests are scoped strictly to `profiles.store_id`. Blocks access to `capital_ledger`, COGS (`variant_public_view`), global catalog mutations, and cross-store data. |
| **2. Edge Routing** | Next.js Middleware | Intercepts requests globally. Unauthenticated traffic is forcibly routed to `/login` before server execution. |
| **3. Server Compute** | Server Component Guards | Custom assertions (`requireUser()`, `requireAdmin()`) validate JWT claims on a per-route and per-action basis. |
| **4. Client UI** | Conditional Rendering | Sensitive data (e.g., cost metrics, global admin navigation) is omitted entirely from the DOM and network payloads for non-admin roles. |

**System Roles:**
*   `system_admin`: Unrestricted global access, financial ledger control, and user provisioning.
*   `store_manager`: Tenant-scoped access limited strictly to local point-of-sale operations and local inventory monitoring.

---

## 4. Metadata-Driven Configuration Engine

The application is vertically agnostic. Business logic, terminology, and UI schemas are generated dynamically via a centralized configuration store.

### Global Settings State (`app_settings` Table)
A key/value store managed by administrators. Cached per-request for all authenticated users.
*   `business_name` → Dynamically injects branding across sidebar, titles, and localized assets.
*   `currency_symbol` / `locale` → Drives application-wide string formatting for financials.
*   `size_unit` → Dynamically populates labels and form inputs (e.g., ml, oz, cm).
*   `product_categories` → Master taxonomy definition.
*   `category_options` → Context-aware secondary attributes (e.g., mapping "Fragrance" to EDT/EDP dropdowns).
*   `perfume_features` → Global feature flags to toggle specific UI components (e.g., scent notes).

### Tenant-Level Overrides (`stores.categories`)
*   Defines a subset of the master taxonomy available per store (stored as `text[]`). A `NULL` value explicitly inherits the global master list.
*   Client-side hydration automatically swaps variant options and sales filters based on the selected store's category permissions.


---

## 5. Domain-Driven Data Models

The database schema is highly normalized and relies heavily on PostgreSQL native triggers for data integrity.

### Catalog & Inventory Domain
*   **Hierarchy:** `products` → `product_variants` → `product_notes` & `batches`.
*   **Ledger (Append-Only):** `stock_movements` acts as an immutable audit log for purchases, adjustments, and wastage.
*   **Event Sourcing:** The `apply_stock_movement` PostgreSQL trigger reacts to movements, atomically aggregating real-time totals into the `inventory_levels` table (composite key: `store_id` × `variant_id`).

### Financial & Sales Domain
*   **Point of Sale:** Transactions write to `sales_transactions` and `sale_items`. The `deduct_sale_stock` trigger automatically decrements respective `inventory_levels`. (Deletion is a hard-restricted admin operation).
*   **Capital Management:** The `capital_ledger` tracks overarching business equity, discrete allocations, and OPEX. (Strictly `system_admin` isolated).

### Analytics & Aggregation
*   **RPC Layer:** Dashboard metrics are driven by a single, highly optimized PL/pgSQL function (`store_sales_summary_all`).
*   **Execution:** Runs under the invoker's RLS context, resolving 14-day trailing charts, per-store breakdowns, and low-stock warnings in a single parallel query batch.

---

## 6. Application Routing & Presentation

**Navigation Paradigm:** Floating glass-morphism sidebar for desktop viewports; anchored bottom navigation bar with a secondary action sheet for mobile interfaces.

| Route | Auth Requirement | Functional Purpose |
| :--- | :--- | :--- |
| `/login` | Public | Authentication gateway & global theme initialization. |
| `/` | Authenticated | Command center, analytical charts, and KPI widgets. |
| `/sales` | Authenticated | Point of Sale (POS) interface and historical transaction logs. |
| `/inventory` | Authenticated | Distributed stock monitoring and movement auditing. |
| `/products` / `[id]` | Authenticated | Master SKU catalog, batch management, and taxonomy control. |
| `/stores` | Admin Only | Store tenant provisioning and category restriction management. |
| `/users` | Admin Only | IAM control: register, disable, and reset credentials. |
| `/capital` | Admin Only | Executive financial ledger and cash flow monitoring. |
| `/settings` | Authenticated | User profile management (Password). Admin-tier unlocks the System Configuration panel. |

---

## 7. Infrastructure, Environments, & CI/CD

**Environment Variables:** Managed via `.env.local` for local development (gitignored) and synced to Vercel for the edge deployments.
*   **Production Domain:** `inventory.ronaldqa.dev`
*   **Database Project:** Supabase ID `xudkihdagubicbghroqj` (Shared across environments currently, standard practice requires environment splitting for general availability).

**Database Migration Strategy:**
SQL migrations are deterministic and executed strictly in the following sequence:
1.  `001_schema` — Base DDL and relationships.
2.  `002_rls_policies` — Security policy definitions.
3.  `003_settings` — Configuration engine seed data.
4.  `004_dashboard_rpc` — Aggregation functions.
5.  `005_category_options` — Contextual attribute schemas.
6.  `006_store_categories` — Tenant restrictions.

---

## 8. Risk Register & Technical Debt Remediation

The following items are critical path deliverables required prior to enterprise general availability (GA):

1.  **UX / Logic Constraint:** The Administrative Stock-In form currently bypasses `stores.categories` filtering; it must be updated to restrict variant selections based on the target tenant's category allowlist.
2.  **CRUD Incompleteness:** The Store Categories management panel is currently Create-only. Update `stores` UI to support full Read, Update, and Delete operations.
3.  **Authentication Security:** Deprecate the static `password123` fallback. Implement a mandatory "Change Password on First Login" flow for newly provisioned or reset accounts via Supabase Auth triggers.
4.  **Quality Assurance (QA):** Implement an end-to-end (E2E) testing suite (e.g., Playwright) and automated PostgreSQL RLS regression tests within the CI/CD pipeline to ensure security policies do not silently fail during future migrations.

