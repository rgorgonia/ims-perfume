"use client";

import { useActionState, useState } from "react";
import type { SaleResult } from "./page";

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
 *  selected store's configured categories (null = all categories), the
 *  per-store available stock is listed, and out-of-stock variants are
 *  disabled so sales never silently fail. */
export default function SaleForm({
  action,
  stores,
  variants,
  availability,
  sizeUnit,
  currencySymbol,
}: {
  action: (prev: SaleResult, formData: FormData) => Promise<SaleResult>;
  stores: StoreT[];
  variants: VariantT[];
  availability: Record<string, Record<string, number>>;
  sizeUnit: string;
  currencySymbol: string;
}) {
  const [res, submit, pending] = useActionState(action, {} as SaleResult);
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState(1);

  const store = stores.find((s) => s.id === storeId);
  const allowed =
    !store?.categories || store.categories.length === 0
      ? null
      : store.categories;
  let filtered = allowed
    ? variants.filter((v) => {
        const cat = v.products?.category;
        return cat ? allowed.includes(cat) : false;
      })
    : variants;

  const availFor = (v: VariantT) => availability[v.id]?.[storeId] ?? 0;

  // In-stock variants first so low/empty stock sinks to the bottom.
  filtered = [...filtered].sort((a, b) => availFor(b) - availFor(a));

  const selected = variants.find((v) => v.id === variantId);
  const maxQty = selected ? Math.max(availFor(selected), 0) : 0;
  const noVariantAvailable = selected ? maxQty < 1 : false;

  return (
    <form
      action={submit}
      className="grid gap-3 rounded-2xl border border-neutral-200 bg-white dark:bg-transparent p-4 sm:grid-cols-2 dark:border-neutral-800"
    >
      {res?.error && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          {res.error}
        </p>
      )}
      {res?.success && (
        <p
          role="status"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 sm:col-span-2 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {res.success}
        </p>
      )}
      <div className="space-y-1">
        <label htmlFor="sf-store" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Store *</label>
        <select
          id="sf-store"
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
      </div>
      <div className="space-y-1">
        <label htmlFor="sf-variant" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Product variant *</label>
        <select
          id="sf-variant"
          name="variant_id"
          required
          className={inputCls}
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
        >
        <option value="">Select product variant *</option>
        {filtered.map((v) => {
          const a = availFor(v);
          return (
            <option key={v.id} value={v.id} disabled={a < 1}>
              {v.products?.name} — {v.sku} ({v.size_ml}
              {sizeUnit}) — {currencySymbol}
              {Number(v.retail_price).toFixed(2)} · {a} available
            </option>
          );
        })}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="sf-qty" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Quantity *</label>
        <input
          id="sf-qty"
          name="quantity"
          type="number"
          min="1"
          max={maxQty || undefined}
          required
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          placeholder="Quantity *"
          className={inputCls}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="sf-payment" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Payment method</label>
        <select id="sf-payment" name="payment_method" className={inputCls}>
          <option value="cash">Cash</option>
          <option value="gcash">GCash</option>
          <option value="card">Card</option>
          <option value="bank_transfer">Bank transfer</option>
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="sf-discount" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Discount (optional)</label>
        <input
          id="sf-discount"
          name="discount"
          type="number"
          step="0.01"
          min="0"
          placeholder="Discount (optional)"
          className={inputCls}
        />
      </div>
      <button
        type="submit"
        disabled={pending || noVariantAvailable}
        className="rounded-2xl btn-neon px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
      >
        {pending ? "Recording…" : "Record sale"}
      </button>
    </form>
  );
}