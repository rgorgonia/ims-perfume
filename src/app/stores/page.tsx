import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Store = {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
};

async function createStore(formData: FormData) {
  "use server";
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  await supabase.from("stores").insert({
    name,
    address: address || null,
  });
  revalidatePath("/stores");
}

export default async function StoresPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name, address, is_active")
    .order("name");

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8">
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Add store</h1>
        <form
          action={createStore}
          className="grid gap-3 rounded-xl border border-neutral-200 p-4 sm:grid-cols-2 dark:border-neutral-800"
        >
          <input
            name="name"
            required
            placeholder="Store name"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-transparent"
          />
          <input
            name="address"
            placeholder="Address (optional)"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-transparent"
          />
          <button
            type="submit"
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 sm:col-span-2"
          >
            Create store
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">All stores</h2>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-left dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Address</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(stores ?? []).map((s: Store) => (
                <tr key={s.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-4 py-2 font-medium">{s.name}</td>
                  <td className="px-4 py-2">{s.address ?? "—"}</td>
                  <td className="px-4 py-2">{s.is_active ? "Active" : "Inactive"}</td>
                </tr>
              ))}
              {(stores ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-neutral-500">
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
