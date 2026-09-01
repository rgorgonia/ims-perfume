import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import SaleForm from "./sale-form";

type Store = { id: string; name: string; categories: string[] | null };
type Variant = {
  id: string;
  sku: string;
  size_ml: number;
  retail_price: number;
  products: { name: string; category: string | null } | null;
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
  const { currencySymbol, sizeUnit } = await getSettings();
  const session = await requireUser();
  const supabase = await createClient();

  const [{ data: stores }, { data: variants }, { data: sales }] =
    await Promise.all([
      supabase.from("stores").select("id, name, categories").order("name"),
      supabase
        .from("variant_public_view")
        .select("id, sku, size_ml, retail_price, products(name, category)")
        .order("sku")
        .limit(200),
      supabase
        .from("sales_transactions")
        .select("id, total, payment_method, created_at, stores(name)")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-6 sm:py-8">
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Record sale</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Stock is deducted automatically via the{" "}
          <code>deduct_sale_stock</code> database trigger.
        </p>
        <SaleForm
          action={recordSale}
          stores={(stores ?? []) as unknown as Store[]}
          variants={(variants ?? []) as unknown as Variant[]}
          sizeUnit={sizeUnit}
          currencySymbol={currencySymbol}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Recent sales</h2>
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:bg-transparent dark:border-neutral-800 dark:bg-transparent">
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
                    {currencySymbol}{Number(s.total).toFixed(2)}
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
