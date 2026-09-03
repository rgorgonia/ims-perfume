import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";

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
  const isPrivileged = session.isPlatformAdmin || session.isTenantOwner;
  const supabase = await createClient();

  const storeId = String(formData.get("store_id") ?? "");
  const variantId = String(formData.get("variant_id") ?? "");
  const movementType = String(formData.get("movement_type") ?? "purchase");
  const rawQty = Number(formData.get("quantity") ?? 0);
  const lotNumber = String(formData.get("lot_number") ?? "").trim();
  const expiresOn = String(formData.get("expires_on") ?? "").trim();

  if (!storeId || !variantId || !rawQty) return;

  // Derive the tenant from the store being stocked — never from the session.
  // A platform admin operates globally, so stamping session.tenant_id would
  // attach cross-tenant stock/batches to the wrong tenant.
  const { data: storeRow } = await supabase
    .from("stores")
    .select("tenant_id")
    .eq("id", storeId)
    .single();
  const storeTenantId = storeRow?.tenant_id as string | undefined;
  if (!storeTenantId) return;

  // Wastage always removes stock; purchase adds; adjustment is signed input.
  const quantity =
    movementType === "wastage"
      ? -Math.abs(rawQty)
      : movementType === "adjustment"
        ? rawQty
        : Math.abs(rawQty);

  // Optional batch/lot (privileged only — managers can't write to batches).
  let batchId: string | null = null;
  if (isPrivileged && lotNumber) {
    const { data: existing } = await supabase
      .from("batches")
      .select("id")
      .eq("product_variant_id", variantId)
      .eq("lot_number", lotNumber)
      .maybeSingle();
    if (existing) {
      batchId = existing.id;
    } else {
      const { data: created } = await supabase
        .from("batches")
        .insert({
          product_variant_id: variantId,
          lot_number: lotNumber,
          expires_on: expiresOn || null,
          tenant_id: storeTenantId,
        })
        .select("id")
        .single();
      batchId = created?.id ?? null;
    }
  }

  const { error } = await supabase.from("stock_movements").insert({
    variant_id: variantId,
    store_id: storeId,
    tenant_id: storeTenantId,
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
  const isPrivileged = session.isPlatformAdmin || session.isTenantOwner;
  const { sizeUnit } = await getSettings(session.tenant_id);
  const supabase = await createClient();

  // Scope the store list to what the signed-in user may actually operate on:
  // a bound user (owner with a store, or manager) sees only their store;
  // tenant-bound users see their tenant's stores; platform admins see all.
  const boundStoreId = session.profile?.store_id ?? null;
  const storesQuery = supabase.from("stores").select("id, name, tenant_id").order("name");
  if (boundStoreId) {
    storesQuery.eq("id", boundStoreId);
  } else if (!session.isPlatformAdmin && session.tenant_id) {
    storesQuery.eq("tenant_id", session.tenant_id);
  }
  const storeIds = new Set<string>();

  const [{ data: stores }, { data: variants }, { data: levels }] =
    await Promise.all([
      storesQuery,
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
  for (const s of (stores ?? []) as { id: string }[]) storeIds.add(s.id);

  // Aggregate batch-level rows to variant × store totals
  const totals = new Map<string, { name: string; sku: string; store: string; qty: number }>();
  for (const l of (levels ?? []) as unknown as Level[]) {
    // Skip stock held at stores this user cannot operate on.
    if (!storeIds.has(l.store_id)) continue;
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
    <div className="mx-auto max-w-5xl space-y-8 py-6 sm:py-8">
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Record stock movement</h1>
        <form
          action={recordMovement}
          className="grid gap-3 rounded-2xl border border-neutral-200 bg-white dark:bg-transparent p-4 sm:grid-cols-2 dark:border-neutral-800"
        >
          <div className="space-y-1">
            <label htmlFor="inv-store" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Store *</label>
            <select id="inv-store" name="store_id" required className={inputCls}>
              <option value="">Select store</option>
              {(stores ?? []).map((s: Store) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="inv-variant" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Product variant *</label>
            <select id="inv-variant" name="variant_id" required className={inputCls}>
              <option value="">Select variant</option>
              {((variants ?? []) as unknown as Variant[]).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.products?.name} — {v.sku} ({v.size_ml}
                  {sizeUnit})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="inv-movement" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Movement type</label>
            <select id="inv-movement" name="movement_type" className={inputCls}>
              <option value="purchase">Purchase (stock in)</option>
              <option value="adjustment">Adjustment (+/-)</option>
              <option value="wastage">Wastage (removes)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="inv-qty" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Quantity *</label>
            <input
              id="inv-qty"
              name="quantity"
              type="number"
              required
              placeholder="Quantity *"
              className={inputCls}
            />
          </div>
          {isPrivileged && (
            <>
              <div className="space-y-1">
                <label htmlFor="inv-lot" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Batch lot number (optional)</label>
                <input
                  id="inv-lot"
                  name="lot_number"
                  placeholder="Batch lot number (optional)"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="inv-exp" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Expires on</label>
                <input
                  id="inv-exp"
                  name="expires_on"
                  type="date"
                  className={inputCls}
                  aria-label="Expires on"
                />
              </div>
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

