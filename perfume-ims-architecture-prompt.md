# Perfume Business Inventory Management System (IMS)
## AI Architecture & Development Prompt

**Instructions for use:** Copy the text below the divider and paste it into your AI assistant to kickstart the system architecture and database design for your Next.js application.

---

> Act as an expert full-stack developer and system architect. I am building a custom Inventory Management System (IMS) and Business Dashboard specifically for a multi-location perfume business.
>
> ### **1. Project Context & Tech Stack**
> *   **Deployment:** Vercel on a dedicated subdomain (`inventory.ronaldqa.dev`) using serverless architecture.
> *   **Frontend Framework:** Next.js 15 (App Router) using TypeScript.
> *   **UI & Styling:** TailwindCSS, Shadcn UI for core components, and Framer Motion for animations.
> *   **Backend/Database:** Supabase (PostgreSQL) leveraging Row-Level Security (RLS) for data isolation.
> *   **QA & Tools:** Playwright for E2E testing, Postman for API validation, and Azure DevOps for CI/CD and project management.
>
> ### **2. Core Architecture Requirements**
>
> **A. Multi-Store Management**
> *   The system must support multiple independent store locations (e.g., Store A and Store B).
> *   Inventory stock levels must be tracked per store, not just globally.
>
> **B. Role-Based Access Control (RBAC)**
> *   **System Admin:** Can view all stores, manage global inventory, register new staff members, and view all financial data (overall capital, total earnings, profit margins).
> *   **Store Manager:** Can only view and manage inventory for their assigned store(s), log sales/transactions for their store, but *cannot* view global capital, overall business profits, or wholesale costs.
>
> **C. Perfume-Specific Inventory Logic**
> *   Track volume variants for a single parent fragrance (e.g., 30ml, 50ml, 100ml, testers).
> *   Track batch/lot numbers and expiration dates for quality control.
> *   Tag products by scent profile (Top, Heart, Base notes) and concentration (EDT, EDP, Extrait).
>
> **D. Financial & Earnings Tracking**
> *   **Capital Management:** Track initial investments and allocated operational capital.
> *   **Cost of Goods Sold (COGS):** Track the wholesale or production cost of each perfume variant.
> *   **Sales & Revenue:** Log individual transactions at the store level to calculate gross earnings.
> *   **Profitability Analytics:** Dashboard reporting that calculates net profit (Sales Revenue minus COGS) per store and globally.
>
> ### **3. Initial Deliverables Required**
> Please provide the following to begin development:
>
> 1.  **Database Schema:** A detailed PostgreSQL schema (for Supabase). It must include tables for `stores`, `users`/`roles`, `products`, `product_variants`, `inventory_levels` (bridging variants and stores), `capital_ledger`, and `sales_transactions`.
> 2.  **Security & RLS Strategy:** Explain exactly how to write Supabase Row-Level Security (RLS) policies so a Store Manager can insert a sale for their store, but cannot query the `capital_ledger` or the wholesale COGS data from the `product_variants` table.
> 3.  **Next.js Dashboard API Architecture:** A brief architectural explanation of how to aggregate this financial data (e.g., daily earnings, total capital remaining) efficiently in Next.js 15 Server Components without overloading the database or running into serverless timeout limits.
> 4.  **Admin Flow:** Explain how the System Admin will securely register new users and assign them to a store using Supabase Auth.

---

## Why this architecture matters

*   **Row-Level Security (RLS):** Database-level security automatically filters out stores a user isn't assigned to — no complex backend code needed.
*   **Financial Security via RLS:** Store Managers can ring up a ₱5,000 perfume sale without ever seeing the ₱1,200 wholesale cost or the business capital ledger.
*   **Inventory bridging:** The `inventory_levels` table allows the same perfume variant to have 10 units in Store A and 5 units in Store B simultaneously.
*   **Data Aggregation:** Financial dashboards are designed to stay fast under Vercel's serverless constraints.

## Vercel Deployment Notes

*   Add `inventory.ronaldqa.dev` as a custom domain in the project's **Settings > Domains** — SSL is provisioned automatically (required for `.dev` domains due to HSTS preloading).
*   Custom domains and subdomains are free on both Hobby and Pro plans; the project only shares your account's usage limits.
*   Use an external database (Supabase) with connection pooling, since Vercel serverless functions spin up and down constantly.
