import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Entry = {
  id: string;
  entry_type: string;
  amount: number;
  description: string | null;
  created_at: string;
  stores: { name: string } | null;
};

async function addEntry(formData: FormData) {
  "use server";
  const session = await requireAdmin();
  const supabase = await createClient();

  const entryType = String(formData.get("entry_type") ?? "");
  const storeId = String(formData.get("store_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const description = String(formData.get("description") ?? "").trim();
  if (!entryType || !amount) return;

  // capital_in/out are business-wide (store_id null); allocations/expenses may target a store
  const signed =
    entryType === "capital_in"
      ? Math.abs(amount)
      : -Math.abs(amount);

  const { error } = await supabase.from("capital_ledger").insert({
    entry_type: entryType,
    store_id: storeId || null,
    amount: signed,
    description: description || null,
    created_by: session.user.id,
  });
  if (error) return;
  revalidatePath("/capital");
  revalidatePath("/");
}


export default async function CapitalPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: entries }, { data: stores }] = await Promise.all([
    supabase
      .from("capital_ledger")
      .select("id, entry_type, amount, description, created_at, stores(name)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("stores").select("id, name").order("name"),
  ]);

  const balance = (entries ?? []).reduce((a, e) => a + Number(e.amount), 0);
  const peso = (n: number) =>
    `₱${Number(n).toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

  const inputCls =
    "rounded-[10px] border border-black/10 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-transparent";

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Capital ledger</h1>
          <p className="text-sm text-neutral-500">
            Balance:{" "}
            <span className={`font-bold ${balance < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
              {peso(balance)}
            </span>
          </p>
        </div>
        <form
          action={addEntry}
          className="grid gap-3 rounded-2xl border border-neutral-200 bg-white dark:bg-transparent p-4 sm:grid-cols-2 dark:border-neutral-800"
        >
          <select name="entry_type" required className={inputCls}>
            <option value="capital_in">Capital in (investment)</option>
            <option value="capital_out">Capital out (withdrawal)</option>
            <option value="store_allocation">Store allocation</option>
            <option value="expense">Expense</option>
          </select>
          <select name="store_id" className={inputCls}>
            <option value="">Business-wide</option>
            {(stores ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input
            name="amount"
            type="number"
            step="0.01"
            required
            placeholder="Amount * (sign ignored)"
            className={inputCls}
          />
          <input
            name="description"
            placeholder="Description"
            className={inputCls}
          />
          <button
            type="submit"
            className="rounded-2xl btn-neon px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 sm:col-span-2"
          >
            Add entry
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Recent entries</h2>
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:bg-transparent dark:border-neutral-800 dark:bg-transparent">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-left dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Store</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {((entries ?? []) as unknown as Entry[]).map((e) => (
                <tr key={e.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-4 py-2">
                    {new Date(e.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 capitalize">
                    {e.entry_type.replace("_", " ")}
                  </td>
                  <td className="px-4 py-2">{e.stores?.name ?? "—"}</td>
                  <td className="px-4 py-2">{e.description ?? "—"}</td>
                  <td className={`px-4 py-2 text-right font-medium ${Number(e.amount) < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {peso(Number(e.amount))}
                  </td>
                </tr>
              ))}
              {(entries ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                    No entries yet.
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
