"use client";

import { useState } from "react";

type StoreT = { id: string; name: string; categories: string[] | null };
type VariantT = {
  id: string;
  sku: string;
  size_ml: number;
  retail_price: number;
  products: { name: string; category: string | null } | null;
};

const inputCls =
  "rounded-[10px] border border-black/10 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-transparent";

/** Sale form where the variant dropdown only shows products in the
 *  selected store's configured categories (null = all categories). */
export default function SaleForm({
  action,
  stores,
  variants,
  sizeUnit,
  currencySymbol,
}: {
  action: (formData: FormData) => void;
  stores: StoreT[];
  variants: VariantT[];
  sizeUnit: string;
  currencySymbol: string;
}) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [variantId, setVariantId] = useState("");

  const store = stores.find((s) => s.id === storeId);
  const allowed =
    !store?.categories || store.categories.length === 0
      ? null
      : store.categories;
  const filtered = allowed
    ? variants.filter((v) => {
        const cat = v.products?.category;
        return cat ? allowed.includes(cat) : false;
      })
    : variants;

  return (
    <form
      action={action}
      className="grid gap-3 rounded-2xl border border-neutral-200 bg-white dark:bg-transparent p-4 sm:grid-cols-2 dark:border-neutral-800"
    >
      <select
        name="store_id"
        required
        className={inputCls}
        value={storeId}
        onChange={(e) => {
          setStoreId(e.target.value);
          setVariantId("");
        }}
      >
        <option value="">Select store *</option>
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <select
        name="variant_id"
        required
        className={inputCls}
        value={variantId}
        onChange={(e) => setVariantId(e.target.value)}
      >
        <option value="">Select product variant *</option>
        {filtered.map((v) => (
          <option key={v.id} value={v.id}>
            {v.products?.name} — {v.sku} ({v.size_ml}
            {sizeUnit}) — {currencySymbol}
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
        className="rounded-2xl btn-neon px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 sm:col-span-2"
      >
        Record sale
      </button>
    </form>
  );
}