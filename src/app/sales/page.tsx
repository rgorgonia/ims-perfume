import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { getAccessibleStores, getActiveStore } from "@/lib/store-scope";
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

export type SaleResult = { error?: string; success?: string };

async function recordSale(
  _prev: SaleResult,
  formData: FormData
): Promise<SaleResult> {
  "use server";
  const session = await requireUser();
  const supabase = await createClient();

  const storeId = String(formData.get("store_id") ?? "");
  const variantId = String(formData.get("variant_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const paymentMethod = String(formData.get("payment_method") ?? "cash");
  const discount = Number(formData.get("discount") ?? 0);

  if (!storeId || !variantId || quantity < 1)
    return { error: "Store, product and a valid quantity are required." };

  // Atomic, SECURITY DEFINER RPC: derives the retail price server-side,
  // validates the store belongs to the caller's tenant, creates the
  // transaction + line item, fills COGS via trigger and deducts stock via
  // trigger — all in one transaction. Oversells roll back cleanly with an
  // "Insufficient stock" error and never leave an orphan transaction.
  const { data, error } = await supabase.rpc("record_sale", {
    p_store: storeId,
    p_variant: variantId,
    p_quantity: quantity,
    p_unit_price: 0, // ignored — price is derived in the database
    p_payment: paymentMethod,
    p_discount: discount,
  });
  if (error) {
    const msg = error.message ?? "";
    const m = msg.match(/insufficient stock.*have (\d+), needed (\d+)/i) ||
      msg.match(/no stock on hand/i);
    if (m)
      return {
        error: m[1]
          ? `Insufficient stock — only ${m[1]} available at this store.`
          : "Insufficient stock — this variant has no stock at this store.",
      };
    if (/unauthorized store/i.test(msg))
      return { error: "You don't have access to that store." };
    if (/unknown or inactive variant/i.test(msg))
      return { error: "That product is not available." };
    if (/discount/i.test(msg))
      return { error: "Discount cannot be negative or exceed the subtotal." };
    return { error: msg || "Could not record the sale." };
  }

  revalidatePath("/sales");
  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/products");
  return { success: "Sale recorded — stock updated." };
}


export default async function SalesPage() {
  const session = await requireUser();
  const { currencySymbol, sizeUnit } = await getSettings(session.tenant_id);
  const supabase = await createClient();

  // Respect the globally selected store (cookie): when one store is active,
  // only its sales/stock are shown so store contents never mix.
  const accessible = await getAccessibleStores(session, supabase);
  const activeStoreId = await getActiveStore(accessible);

  const [
    { data: stores },
    { data: variants },
    { data: sales },
    { data: inventory },
  ] = await Promise.all([
    // Store managers are bound to exactly one store — only offer theirs.
    session.isStoreManager && session.profile?.store_id
      ? supabase.from("stores").select("id, name, categories").eq("id", session.profile.store_id)
      : supabase.from("stores").select("id, name, categories").order("name"),
    supabase
      .from("variant_public_view")
      .select("id, sku, size_ml, retail_price, products(name, category)")
      .order("sku")
      .limit(200),
    (() => {
      let q = supabase
        .from("sales_transactions")
        .select("id, total, payment_method, created_at, stores(name)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(0, 49);
      if (activeStoreId) q = q.eq("store_id", activeStoreId);
      return q;
    })(),
    supabase
      .from("inventory_levels")
      .select("variant_id, store_id, quantity_on_hand"),
  ]);

  // availability[variantId][storeId] = units on hand (RLS-scoped).
  const availability: Record<string, Record<string, number>> = {};
  for (const row of (inventory ?? []) as {
    variant_id: string;
    store_id: string;
    quantity_on_hand: number;
  }[]) {
    if (activeStoreId && row.store_id !== activeStoreId) continue;
    availability[row.variant_id] ??= {};
    availability[row.variant_id][row.store_id] =
      (availability[row.variant_id][row.store_id] ?? 0) +
      Number(row.quantity_on_hand);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-6 sm:py-8">
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">
          Record sale
          {activeStoreId && (
            <span className="ml-3 align-middle inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              scoped to {accessible.find((s) => s.id === activeStoreId)?.name}
            </span>
          )}
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Stock is deducted automatically via the{" "}
          <code>deduct_sale_stock</code> database trigger.
        </p>
        <SaleForm
          action={recordSale}
          stores={((stores ?? []) as unknown as Store[]).filter(
            (s) => !activeStoreId || s.id === activeStoreId
          )}
          variants={(variants ?? []) as unknown as Variant[]}
          availability={availability}
          sizeUnit={sizeUnit}
          currencySymbol={currencySymbol}
          defaultStoreId={activeStoreId ?? undefined}
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
