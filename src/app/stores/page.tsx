import { requirePrivileged } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTaxonomy } from "@/lib/services/taxonomy";
import { getSettings } from "@/lib/settings";
import StoreHub from "./store-hub";
import { StoreRow, CreateStoreForm } from "./store-editor";
import ConfigTabs from "@/app/admin/config/config-tabs";
import TaxonomyManager from "@/app/admin/config/taxonomy-manager";
import SystemSettings from "@/app/admin/config/system-settings";

type Store = {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  categories: string[] | null;
  store_type: string;
};

type UserRow = {
  id: string;
  full_name: string;
  role: string;
  store_id: string | null;
};

export default async function StoresPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requirePrivileged();
  const supabase = await createClient();
  const [{ tab }, taxonomy, settings] = await Promise.all([
    searchParams,
    getTaxonomy(session.tenant_id),
    getSettings(session.tenant_id),
  ]);
  const cats = taxonomy.categories.map((c) => ({ slug: c.slug, label: c.label }));

  const [{ data: stores }, { data: users }] = await Promise.all([
    session.tenant_id
      ? supabase
          .from("stores")
          .select("id, name, address, is_active, categories, store_type")
          .eq("tenant_id", session.tenant_id)
          .order("name")
      : Promise.resolve({ data: [] as unknown[] }),
    supabase
      .from("profiles")
      .select("id, full_name, role, store_id")
      .eq("is_active", true)
      .eq("tenant_id", session.tenant_id ?? "")
      .order("full_name"),
  ]);
  const storesList = (stores ?? []) as Store[];

  const userOpts = (users ?? []) as unknown as UserRow[];

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6 sm:py-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Stores &amp; configuration</h1>
        <p className="text-sm text-neutral-500 dark:text-slate-400">
          Create and edit stores (type, categories sold, and the users assigned
          to them), and manage the platform-wide configuration.
        </p>
      </header>
      <StoreHub
        initial={tab === "config" ? "config" : "stores"}
        storesPanel={
          <div className="space-y-8">
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Add store</h2>
              <p className="text-sm text-neutral-500 dark:text-slate-400">
                Pick the store type and categories it sells, then assign one
                owner and any number of inventory managers. An owner sees that
                store&apos;s revenue &amp; capital; inventory managers handle
                stock &amp; sales only.
              </p>
              <CreateStoreForm taxonomy={cats} users={userOpts} />
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
          </div>
        }
        configPanel={
          <ConfigTabs
            taxonomy={<TaxonomyManager taxonomy={taxonomy} />}
            system={<SystemSettings s={settings} />}
          />
        }
      />
    </div>
  );
}
