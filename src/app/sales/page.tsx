import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Store = { id: string; name: string };
type Variant = {
  id: string;
  sku: string;
  size_ml: number;
  retail_price: number;
  products: { name: string } | null;
};
type Sale = {
  id: string;
  total: number;
  payment_method: string;
  created_at: string;
  stores: { name: string } | null;
};

async function recordSale(formData: FormData) {
  "use server";
  const session = await requireUser();
  const supabase = await createClient();

  const storeId = String(formData.get("store_id") ?? "");
  const variantId = String(formData.get("variant_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const paymentMethod = String(formData.get("payment_method") ?? "cash");
  const discount = Number(formData.get("discount") ?? 0);

  if (!storeId || !variantId || quantity < 1) return;

  const { data: variant } = await supabase
    .from("product_variants")
    .select("retail_price, cost_price")
    .eq("id", variantId)
    .single();
  if (!variant) return;

  const subtotal = Number(variant.retail_price) * quantity;
  const total = Math.max(subtotal - discount, 0);

  const { data: sale, error } = await supabase
    .from("sales_transactions")
    .insert({
      store_id: storeId,
      sold_by: session.user.id,
      payment_method: paymentMethod,
      subtotal,
      discount,
      total,
      total_cogs: Number(variant.cost_price) * quantity,
    })
    .select("id")
    .single();
  if (error || !sale) return;

  const { error: itemError } = await supabase.from("sale_items").insert({
    sale_id: sale.id,
    variant_id: variantId,
    quantity,
    unit_price: variant.retail_price,
    unit_cogs: variant.cost_price,
  });
  if (itemError) {
    // Don't leave an empty transaction behind
    await supabase.from("sales_transactions").delete().eq("id", sale.id);
    return;
  }

  revalidatePath("/sales");
}


export default async function SalesPage() {
  const session = await requireUser();
  const supabase = await createClient();

  const [{ data: stores }, { data: variants }, { data: sales }] =
    await Promise.all([
      supabase.from("stores").select("id, name").order("name"),
      supabase
        .from("variant_public_view")
        .select("id, sku, size_ml, retail_price, products(name)")
        .order("sku")
        .limit(200),
      supabase
        .from("sales_transactions")
        .select("id, total, payment_method, created_at, stores(name)")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const inputCls =
    "rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-transparent";

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Record sale</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Stock is deducted automatically via the{" "}
          <code>deduct_sale_stock</code> database trigger.
        </p>
        <form
          action={recordSale}
          className="grid gap-3 rounded-xl border border-neutral-200 p-4 sm:grid-cols-2 dark:border-neutral-800"
        >
          <select name="store_id" required className={inputCls}>
            <option value="">Select store *</option>
            {(stores ?? []).map((s: Store) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select name="variant_id" required className={inputCls}>
            <option value="">Select product variant *</option>
            {((variants ?? []) as unknown as Variant[]).map((v) => (
              <option key={v.id} value={v.id}>
                {v.products?.name} — {v.sku} ({v.size_ml}ml) — ₱
                {Number(v.retail_price).toFixed(2)}
              </option>
            ))}
          </select>
          <input
            name="quantity"
            type="number"
            min="1"
            required
            placeholder="Quantity *"
            className={inputCls}
          />
          <select name="payment_method" className={inputCls}>
            <option value="cash">Cash</option>
            <option value="gcash">GCash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank transfer</option>
          </select>
          <input
            name="discount"
            type="number"
            step="0.01"
            min="0"
            placeholder="Discount (optional)"
            className={inputCls}
          />
          <button
            type="submit"
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 sm:col-span-2"
          >
            Record sale
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Recent sales</h2>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-left dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Store</th>
                <th className="px-4 py-2">Payment</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {((sales ?? []) as unknown as Sale[]).map((s) => (
                <tr key={s.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-4 py-2">
                    {new Date(s.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">{s.stores?.name ?? "—"}</td>
                  <td className="px-4 py-2 capitalize">
                    {s.payment_method.replace("_", " ")}
                  </td>
                  <td className="px-4 py-2 text-right">
                    ₱{Number(s.total).toFixed(2)}
                  </td>
                </tr>
              ))}
              {(sales ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                    No sales recorded yet.
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
