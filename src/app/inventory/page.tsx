import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Store = { id: string; name: string };
type Variant = {
  id: string;
  sku: string;
  size_ml: number;
  products: { name: string } | null;
};
type Level = {
  variant_id: string;
  store_id: string;
  quantity_on_hand: number;
  product_variants: { sku: string; products: { name: string } | null } | null;
  stores: { name: string } | null;
};

async function recordMovement(formData: FormData) {
  "use server";
  const session = await requireUser();
  const isAdmin = session.profile?.role === "system_admin";
  const supabase = await createClient();

  const storeId = String(formData.get("store_id") ?? "");
  const variantId = String(formData.get("variant_id") ?? "");
  const movementType = String(formData.get("movement_type") ?? "purchase");
  const rawQty = Number(formData.get("quantity") ?? 0);
  const lotNumber = String(formData.get("lot_number") ?? "").trim();
  const expiresOn = String(formData.get("expires_on") ?? "").trim();

  if (!storeId || !variantId || !rawQty) return;

  // Wastage always removes stock; purchase adds; adjustment is signed input.
  const quantity =
    movementType === "wastage"
      ? -Math.abs(rawQty)
      : movementType === "adjustment"
        ? rawQty
        : Math.abs(rawQty);

  // Optional batch/lot (admin-only — RLS blocks manager batch writes)
  let batchId: string | null = null;
  if (isAdmin && lotNumber) {
    const { data: existing } = await supabase
      .from("batches")
      .select("id")
      .eq("product_variant_id", variantId)
      .eq("lot_number", lotNumber)
      .single();
    if (existing) {
      batchId = existing.id;
    } else {
      const { data: created } = await supabase
        .from("batches")
        .insert({
          product_variant_id: variantId,
          lot_number: lotNumber,
          expires_on: expiresOn || null,
        })
        .select("id")
        .single();
      batchId = created?.id ?? null;
    }
  }

  const { error } = await supabase.from("stock_movements").insert({
    variant_id: variantId,
    store_id: storeId,
    batch_id: batchId,
    movement_type: movementType,
    quantity,
    created_by: session.user.id,
    notes: lotNumber ? `lot ${lotNumber}` : null,
  });
  if (error) return;

  revalidatePath("/inventory");
}

export default async function InventoryPage() {
  const session = await requireUser();
  const isAdmin = session.profile?.role === "system_admin";
  const supabase = await createClient();

  const [{ data: stores }, { data: variants }, { data: levels }] =
    await Promise.all([
      supabase.from("stores").select("id, name").order("name"),
      supabase
        .from("variant_public_view")
        .select("id, sku, size_ml, products(name)")
        .order("sku")
        .limit(200),
      supabase
        .from("inventory_levels")
        .select(
          "variant_id, store_id, quantity_on_hand, product_variants(sku, products(name)), stores(name)"
        ),
    ]);

  // Aggregate batch-level rows to variant × store totals
  const totals = new Map<string, { name: string; sku: string; store: string; qty: number }>();
  for (const l of (levels ?? []) as unknown as Level[]) {
    const key = `${l.variant_id}:${l.store_id}`;
    const cur = totals.get(key);
    if (cur) cur.qty += l.quantity_on_hand;
    else
      totals.set(key, {
        name: l.product_variants?.products?.name ?? "Unknown",
        sku: l.product_variants?.sku ?? "—",
        store: l.stores?.name ?? "—",
        qty: l.quantity_on_hand,
      });
  }
  const rows = [...totals.values()].sort((a, b) =>
    a.name.localeCompare(b.name) || a.store.localeCompare(b.store)
  );

  const inputCls =
    "rounded-[10px] border border-black/10 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-transparent";

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Record stock movement</h1>
        <form
          action={recordMovement}
          className="grid gap-3 rounded-2xl border border-neutral-200 bg-white dark:bg-transparent p-4 sm:grid-cols-2 dark:border-neutral-800"
        >
          <select name="store_id" required className={inputCls}>
            <option value="">Select store *</option>
            {(stores ?? []).map((s: Store) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select name="variant_id" required className={inputCls}>
            <option value="">Select variant *</option>
            {((variants ?? []) as unknown as Variant[]).map((v) => (
              <option key={v.id} value={v.id}>
                {v.products?.name} — {v.sku} ({v.size_ml}ml)
              </option>
            ))}
          </select>
          <select name="movement_type" className={inputCls}>
            <option value="purchase">Purchase (stock in)</option>
            <option value="adjustment">Adjustment (+/-)</option>
            <option value="wastage">Wastage (removes)</option>
          </select>
          <input
            name="quantity"
            type="number"
            required
            placeholder="Quantity *"
            className={inputCls}
          />
          {isAdmin && (
            <>
              <input
                name="lot_number"
                placeholder="Batch lot number (optional)"
                className={inputCls}
              />
              <input
                name="expires_on"
                type="date"
                className={inputCls}
                aria-label="Expires on"
              />
            </>
          )}
          <button
            type="submit"
            className="rounded-2xl btn-neon px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 sm:col-span-2"
          >
            Record movement
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Stock on hand</h2>
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:bg-transparent dark:border-neutral-800 dark:bg-transparent">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-left dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">Store</th>
                <th className="px-4 py-2 text-right">Qty on hand</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2">{r.sku}</td>
                  <td className="px-4 py-2">{r.store}</td>
                  <td className={`px-4 py-2 text-right font-medium ${r.qty <= 5 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                    {r.qty}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                    No inventory yet — record a purchase above.
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

