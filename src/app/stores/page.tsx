import { requirePrivileged } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTaxonomy } from "@/lib/services/taxonomy";
import { StoreRow, CreateStoreForm } from "./store-editor";
import TaxonomyManager from "@/app/admin/config/taxonomy-manager";

type StoreConfig = {
  business_name: string | null;
  currency_symbol: string | null;
  currency_locale: string | null;
  size_unit: string | null;
};

type Store = {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  categories: string[] | null;
  store_type: string;
  tenant_id: string;
  config?: StoreConfig | null;
};

type UserRow = {
  id: string;
  full_name: string;
  role: string;
  store_id: string | null;
  tenant_id: string | null;
};

export default async function StoresPage() {
  const session = await requirePrivileged();
  const supabase = await createClient();
  const taxonomy = await getTaxonomy(session.tenant_id);
  const cats = taxonomy.categories.map((c) => ({ slug: c.slug, label: c.label }));

  // Platform admins can pick the tenant when creating a store.
  let tenants: { id: string; name: string }[] = [];
  if (session.isPlatformAdmin) {
    const { data } = await supabase
      .from("tenants")
      .select("id, name")
      .order("name");
    tenants = (data ?? []) as { id: string; name: string }[];
  }

  const [{ data: stores }, { data: users }] = await Promise.all([
    // Platform admins operate globally — show every tenant's stores.
    // Tenant-bound users see only their own tenant's stores.
    !session.tenant_id || session.isPlatformAdmin
      ? supabase
          .from("stores")
          .select("id, name, address, is_active, categories, store_type, tenant_id, tenants(name)")
          .order("name")
      : supabase
          .from("stores")
          .select("id, name, address, is_active, categories, store_type, tenant_id, tenants(name)")
          .eq("tenant_id", session.tenant_id)
          .order("name"),
    supabase
      .from("profiles")
      .select("id, full_name, role, store_id, tenant_id")
      .eq("is_active", true)
      // Platform admins assign staff across every tenant; tenant-bound
      // users only ever assign inside their own tenant.
      .in("role", ["store_manager", "tenant_owner"])
      .order("full_name"),
  ]);
  const storesList = (stores ?? []) as Store[];

  // Attach each store's own isolated config (tenant_settings row keyed by
  // store_id) so the edit form shows exactly that store's configuration.
  const storeIds = storesList.map((s) => s.id);
  const { data: configRows } = storeIds.length
    ? await supabase
        .from("tenant_settings")
        .select("store_id, business_name, currency_symbol, currency_locale, size_unit")
        .in("store_id", storeIds)
    : { data: [] };
  const configByStore = new Map<string, StoreConfig>();
  for (const r of (configRows ?? []) as unknown as (StoreConfig & { store_id: string })[]) {
    if (r.store_id) configByStore.set(r.store_id, r);
  }
  for (const s of storesList) s.config = configByStore.get(s.id) ?? null;

  const userOpts = (users ?? []) as unknown as UserRow[];

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6 sm:py-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Stores</h1>
        <p className="text-sm text-neutral-500 dark:text-slate-400">
          Create and edit stores — each store carries its own configuration
          (business name, currency, size unit) that never mixes with another
          store&apos;s. Manage the product taxonomy below.
        </p>
      </header>
      <div className="space-y-8">
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Add store</h2>
          <p className="text-sm text-neutral-500 dark:text-slate-400">
            Pick the store type and the categories it sells, then assign
            inventory managers. After creating the store, add its own
            configuration (business name, currency, size unit) any time via{" "}
            <span className="font-medium">Edit</span> — every store keeps its
            own config, separate from the others.
          </p>
          <CreateStoreForm taxonomy={cats} users={userOpts} tenants={tenants} />
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">All stores</h2>
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:bg-transparent dark:border-neutral-800">
            {storesList.map((store) => (
              <StoreRow key={store.id} store={store} taxonomy={cats} users={userOpts} />
            ))}
            {storesList.length === 0 && (
              <p className="p-6 text-center text-sm text-neutral-500">
                No stores yet — add your first one above.
              </p>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Product taxonomy</h2>
          <p className="text-sm text-neutral-500 dark:text-slate-400">
            Product categories and their attribute fields, shared across stores.
          </p>
          <TaxonomyManager taxonomy={taxonomy} />
        </section>
      </div>
    </div>
  );
}
