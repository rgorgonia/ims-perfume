import { requirePrivileged } from "@/lib/auth";
import { getTaxonomy } from "@/lib/services/taxonomy";
import TaxonomyManager from "./taxonomy-manager";

// Dedicated taxonomy editor (categories + per-category attribute fields).
// Taxonomy is tenant-wide — it is shared by every store in a tenant, so it
// lives on its own screen rather than inside any single store's edit form.
export default async function TaxonomyPage() {
  const session = await requirePrivileged();
  const taxonomy = await getTaxonomy(session.tenant_id);

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6 sm:py-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Taxonomy</h1>
        <p className="text-sm text-neutral-500 dark:text-slate-400">
          Product categories and their attribute fields. This catalog is shared
          across all of your stores — stores then pick which of these categories
          they sell (under Stores → Edit).
        </p>
      </header>
      <TaxonomyManager taxonomy={taxonomy} />
    </div>
  );
}
