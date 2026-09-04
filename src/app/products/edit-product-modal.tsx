"use client";

import { useActionState, useEffect, useState } from "react";
import { updateProductAction, type ProductEditResult } from "./actions";

const inputCls =
  "w-full rounded-[10px] border border-black/10 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-transparent";

type Category = { slug: string; label: string };

/** Modal editor for a catalog product (name, brand, category, retail price,
 *  active toggle). Matches the store review modal's visual pattern. */
export default function EditProductModal({
  product,
  categories,
}: {
  product: {
    id: string;
    name: string;
    brand: string | null;
    category: string | null;
    retail_price: number;
    is_active: boolean;
  };
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const [res, formAction, pending] = useActionState(updateProductAction, {} as ProductEditResult);

  useEffect(() => {
    if (res.success) setOpen(false);
  }, [res.success]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-neutral-500 underline decoration-dotted underline-offset-2 hover:text-neutral-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        Edit
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-product-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 id="edit-product-title" className="text-base font-semibold">
                  Edit product
                </h3>
                <p className="text-xs text-neutral-500 dark:text-slate-400">
                  Variants are managed on the product&apos;s detail page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close editor"
                className="rounded-full p-1.5 text-neutral-500 hover:bg-black/[0.05] dark:text-slate-400 dark:hover:bg-white/10"
              >
                ✕
              </button>
            </div>
            <form action={formAction} className="space-y-3">
              <input type="hidden" name="product_id" value={product.id} />
              {res.error && (
                <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                  {res.error}
                </p>
              )}
              <div className="space-y-1">
                <label htmlFor="ep-name" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Product name *
                </label>
                <input id="ep-name" name="name" required defaultValue={product.name} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label htmlFor="ep-brand" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Brand
                </label>
                <input id="ep-brand" name="brand" defaultValue={product.brand ?? ""} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label htmlFor="ep-category" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Category
                </label>
                <select id="ep-category" name="category" defaultValue={product.category ?? ""} className={inputCls}>
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="ep-retail" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Retail price
                </label>
                <input
                  id="ep-retail"
                  name="retail_price"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={product.retail_price}
                  className={inputCls}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="is_active" defaultChecked={product.is_active} className="h-4 w-4" />
                Active (visible in the catalog)
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-2xl border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-2xl btn-neon px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-60"
                >
                  {pending ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
