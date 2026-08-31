import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";

type Store = {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  categories: string[] | null;
};

async function createStore(formData: FormData) {
  "use server";
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  if (!name) return;

  // Checked categories; none checked = all categories (null)
  const categories = formData.getAll("categories").map(String);

  const supabase = await createClient();
  await supabase.from("stores").insert({
    name,
    address: address || null,
    categories: categories.length ? categories : null,
  });
  revalidatePath("/stores");
}

export default async function StoresPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { categories } = await getSettings();

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name, address, is_active, categories")
    .order("name");

  const inputCls =
    "rounded-[10px] border border-black/10 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-transparent";

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8">
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Add store</h1>
        <form
          action={createStore}
          className="grid gap-3 rounded-2xl border border-neutral-200 bg-white dark:bg-transparent p-4 sm:grid-cols-2 dark:border-neutral-800"
        >
          <input
            name="name"
            required
            placeholder="Store name"
            className={inputCls}
          />
          <input
            name="address"
            placeholder="Address (optional)"
            className={inputCls}
          />
          <fieldset className="sm:col-span-2">
            <legend className="mb-1 text-sm font-medium">
              Categories sold{" "}
              <span className="font-normal text-neutral-500">
                (leave all unchecked to sell everything)
              </span>
            </legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {categories.map((c) => (
                <label
                  key={c}
                  className="flex items-center gap-1.5 text-sm text-neutral-700 dark:text-slate-300"
                >
                  <input
                    type="checkbox"
                    name="categories"
                    value={c}
                    className="h-4 w-4"
                  />
                  {c}
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="submit"
            className="rounded-2xl btn-neon px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 sm:col-span-2"
          >
            Create store
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">All stores</h2>
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:bg-transparent dark:border-neutral-800 dark:bg-transparent">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-left dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Address</th>
                <th className="px-4 py-2">Categories</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(stores ?? []).map((s: Store) => (
                <tr key={s.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-4 py-2 font-medium">{s.name}</td>
                  <td className="px-4 py-2">{s.address ?? "—"}</td>
                  <td className="px-4 py-2">
                    {!s.categories || s.categories.length === 0
                      ? "All"
                      : s.categories.join(", ")}
                  </td>
                  <td className="px-4 py-2">{s.is_active ? "Active" : "Inactive"}</td>
                </tr>
              ))}
              {(stores ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                    No stores yet — add your first one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
