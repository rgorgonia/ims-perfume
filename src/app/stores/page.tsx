import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTaxonomy } from "@/lib/services/taxonomy";
import { StoreRow, CreateStoreForm } from "./store-editor";

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
  store_role: string;
  store_id: string | null;
};

export default async function StoresPage() {
  await requireAdmin();
  const supabase = await createClient();
  const taxonomy = await getTaxonomy();
  const cats = taxonomy.categories.map((c) => ({ slug: c.slug, label: c.label }));

  const [{ data: stores }, { data: users }] = await Promise.all([
    supabase
      .from("stores")
      .select("id, name, address, is_active, categories, store_type")
      .order("name"),
    supabase
      .from("profiles")
      .select("id, full_name, role, store_role, store_id")
      .eq("is_active", true)
      .order("full_name"),
  ]);

  const userOpts = (users ?? []) as unknown as UserRow[];

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-6 sm:py-8">
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Add store</h1>
        <p className="text-sm text-neutral-500 dark:text-slate-400">
          Pick the store type and the categories it sells, then optionally assign
          a user. An assigned <span className="font-medium">inventory manager</span> can
          only manage this store (no revenue); a{" "}
          <span className="font-medium">store owner</span> also sees its revenue
          and capital.
        </p>
        <CreateStoreForm taxonomy={cats} users={userOpts} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">All stores</h2>
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:bg-transparent dark:border-neutral-800">
          {(stores ?? []).map((s) => (
            <StoreRow key={s.id} store={s as Store} taxonomy={cats} users={userOpts} />
          ))}
          {(stores ?? []).length === 0 && (
            <p className="p-6 text-center text-sm text-neutral-500">
              No stores yet — add your first one above.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
