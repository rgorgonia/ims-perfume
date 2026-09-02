"use client";

import { useActionState } from "react";
import type { Taxonomy } from "@/lib/services/taxonomy";
import CategoryAttributeFields from "@/components/category-attribute-fields";
import type { ProductResult } from "./page";

const inputCls =
  "rounded-[10px] border border-black/10 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-transparent";

/** Client add-product form with live error/success feedback (useActionState).
 *  The parent product and its first variant are created together — if the
 *  variant insert fails, the action rolls the product back so we never leave
 *  an orphan (a product with no variant is invisible to Inventory/Sales). */
export default function AddProductForm({
  action,
  taxonomy,
  sizeUnit,
  isAdmin,
}: {
  action: (prev: ProductResult, formData: FormData) => Promise<ProductResult>;
  taxonomy: Taxonomy;
  sizeUnit: string;
  isAdmin: boolean;
}) {
  const [res, submit, pending] = useActionState(action, {} as ProductResult);

  return (
    <form
      action={submit}
      className="grid gap-3 rounded-2xl border border-neutral-200 bg-white dark:bg-transparent p-4 sm:grid-cols-3 dark:border-neutral-800"
    >
      {res?.error && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-3 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          {res.error}
        </p>
      )}
      {res?.success && (
        <p
          role="status"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 sm:col-span-3 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {res.success}
        </p>
      )}
      <div className="space-y-1">
        <label htmlFor="pf-name" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Product name *</label>
        <input id="pf-name" name="name" required placeholder="Product name *" className={inputCls} />
      </div>
      <div className="space-y-1">
        <label htmlFor="pf-brand" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Brand</label>
        <input id="pf-brand" name="brand" placeholder="Brand" className={inputCls} />
      </div>
      <CategoryAttributeFields taxonomy={taxonomy} />
      <div className="space-y-1">
        <label htmlFor="pf-sku" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">SKU (first variant) *</label>
        <input
          id="pf-sku"
          name="sku"
          required
          placeholder="SKU for first variant *"
          className={inputCls}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="pf-size" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Size ({sizeUnit}) *</label>
        <input
          id="pf-size"
          name="size_ml"
          required
          type="number"
          min="1"
          placeholder={`Size (${sizeUnit}) *`}
          className={inputCls}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="pf-retail" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Retail price</label>
        <input
          id="pf-retail"
          name="retail_price"
          type="number"
          step="0.01"
          min="0"
          placeholder="Retail price"
          className={inputCls}
        />
      </div>
      {isAdmin && (
        <div className="space-y-1">
          <label htmlFor="pf-cost" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Cost price (admin)</label>
          <input
            id="pf-cost"
            name="cost_price"
            type="number"
            step="0.01"
            min="0"
            placeholder="Cost price (admin)"
            className={inputCls}
          />
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-2xl btn-neon px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-3"
      >
        {pending ? "Creating…" : "Create product"}
      </button>
    </form>
  );
}
