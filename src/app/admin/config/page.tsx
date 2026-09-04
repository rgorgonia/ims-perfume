import { requirePrivileged } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTaxonomy } from "@/lib/services/taxonomy";
import { getAccessibleStores, getActiveStore } from "@/lib/store-scope";
import TaxonomyManager from "./taxonomy-manager";
import ImportTaxonomyControl from "./import-taxonomy-control";

// Dedicated taxonomy editor (categories + per-category attribute fields).
// Scope follows the store switcher: with a store selected you edit that
// store's OWN taxonomy (invisible to other stores until imported); with
// "All stores" you edit the tenant-wide shared default.
export default async function TaxonomyPage() {
  const session = await requirePrivileged();
  const supabase = await createClient();
  const accessible = await getAccessibleStores(session, supabase);
  const activeStoreId = await getActiveStore(accessible);
  const [taxonomy, otherStores] = await Promise.all([
    getTaxonomy(session.tenant_id, activeStoreId),
    activeStoreId
      ? supabase
          .from("stores")
          .select("id, name")
          .neq("id", activeStoreId)
          .order("name")
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const storeName = accessible.find((s) => s.id === activeStoreId)?.name ?? null;
  const importCandidates = (otherStores.data ?? []) as { id: string; name: string }[];

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6 sm:py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Taxonomy</h1>
        {storeName ? (
          <p className="text-sm text-neutral-500 dark:text-slate-400">
            Editing the taxonomy of <strong>{storeName}</strong> only. Other stores
            keep their own — import from one below if they should match.
          </p>
        ) : (
          <p className="text-sm text-neutral-500 dark:text-slate-400">
            Editing the <strong>shared</strong> taxonomy (all stores without their
            own). Select a store in the switcher to manage that store&apos;s own
            categories and attributes.
          </p>
        )}
        {storeName && importCandidates.length > 0 && (
          <ImportTaxonomyControl storeId={activeStoreId!} candidates={importCandidates} />
        )}
      </header>
      <TaxonomyManager taxonomy={taxonomy} storeId={activeStoreId} />
    </div>
  );
}

