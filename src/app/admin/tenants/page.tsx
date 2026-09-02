import { requirePlatformAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import TenantConsole, { type TenantRow, type PlatformTotals } from "./tenant-console";

export default async function TenantsPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();

  // Aggregate tenant stats in three small queries (no cross-tenant RLS issues:
  // platform admins bypass RLS via is_platform_admin()).
  const [{ data: tenants }, { data: stores }, { data: profiles }, { data: sales }] =
    await Promise.all([
      supabase.from("tenants").select("*").order("created_at", { ascending: true }),
      supabase.from("stores").select("id, tenant_id"),
      supabase.from("profiles").select("id, tenant_id"),
      supabase
        .from("sales_transactions")
        .select("total, tenant_id")
        .gte(
          "created_at",
          new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
        ),
    ]);

  const rows: TenantRow[] = (tenants ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    is_active: t.is_active,
    created_at: t.created_at,
    store_count: (stores ?? []).filter((s) => s.tenant_id === t.id).length,
    user_count: (profiles ?? []).filter((p) => p.tenant_id === t.id).length,
    sales_30d: (sales ?? [])
      .filter((s) => s.tenant_id === t.id)
      .reduce((sum, s) => sum + Number(s.total), 0),
  }));

  const totals: PlatformTotals = {
    totalTenants: rows.length,
    activeTenants: rows.filter((r) => r.is_active).length,
    totalStores: (stores ?? []).length,
    sales30d: rows.reduce((sum, r) => sum + r.sales_30d, 0),
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6 sm:py-8">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Tenant console</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Every business renting the platform. Suspending a tenant immediately
          revokes all of its users&apos; database access (RLS-level, not just UI).
        </p>
      </section>
      <TenantConsole tenants={rows} totals={totals} />
    </div>
  );
}
