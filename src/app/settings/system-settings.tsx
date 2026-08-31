"use client";

import { useActionState } from "react";
import { updateSystemSettingsAction } from "@/app/actions";
import type { AppSettings } from "@/lib/settings";
import CategoriesEditor from "./categories-editor";

const inputCls =
  "w-full rounded-[10px] border border-black/10 bg-white/60 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500/60 focus:ring-2 focus:ring-neutral-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white";

export default function SystemSettings({ s }: { s: AppSettings }) {
  const [result, formAction, pending] = useActionState(
    updateSystemSettingsAction,
    {} as { error?: string; success?: string }
  );

  return (
    <section className="soft rounded-[18px] p-6 lg:col-span-2">
      <h2 className="mb-1 text-[15px] font-semibold">System</h2>
      <p className="mb-4 text-xs text-neutral-500 dark:text-slate-400">
        Configure the system for any kind of business — branding, currency,
        units, and product categories.
      </p>
      <form action={formAction} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="business_name" className="text-sm font-medium">
            Business name
          </label>
          <input
            id="business_name"
            name="business_name"
            required
            defaultValue={s.businessName}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="currency_symbol" className="text-sm font-medium">
            Currency symbol
          </label>
          <input
            id="currency_symbol"
            name="currency_symbol"
            required
            defaultValue={s.currencySymbol}
            placeholder="₱, $, €, ¥…"
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="currency_locale" className="text-sm font-medium">
            Number locale
          </label>
          <input
            id="currency_locale"
            name="currency_locale"
            required
            defaultValue={s.currencyLocale}
            placeholder="en-PH, en-US, ja-JP…"
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="size_unit" className="text-sm font-medium">
            Size unit
          </label>
          <input
            id="size_unit"
            name="size_unit"
            required
            defaultValue={s.sizeUnit}
            placeholder="ml, g, pcs…"
            className={inputCls}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm font-medium">
            Product categories
          </label>
          <CategoriesEditor
            name="product_categories"
            initial={s.categories}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="category_options" className="text-sm font-medium">
            Category dropdown options{" "}
            <span className="font-normal text-neutral-500">
              (one line per category: <code>Category: option 1, option 2</code> — leave a line out to hide that dropdown)
            </span>
          </label>
          <textarea
            id="category_options"
            name="category_options"
            rows={3}
            className={`${inputCls} font-mono text-xs`}
            defaultValue={Object.entries(s.categoryOptions)
              .map(([cat, opts]) => `${cat}: ${opts.join(", ")}`)
              .join("\n")}
            placeholder={"Fragrance: EDT, EDP, EXTRAIT, EDC, OIL\nBeverage: Hot, Iced"}
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
          <input
            type="checkbox"
            name="perfume_features"
            defaultChecked={s.perfumeFeatures}
            className="h-4 w-4"
          />
          Perfume-specific features (concentration &amp; scent notes)
        </label>
        <div className="sm:col-span-2">
          {result.error && (
            <p className="mb-3 text-sm text-red-600 dark:text-red-400">{result.error}</p>
          )}
          {result.success && (
            <p className="mb-3 text-sm text-emerald-600 dark:text-emerald-400">{result.success}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="btn-neon rounded-full px-5 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save system settings"}
          </button>
        </div>
      </form>
    </section>
  );
}
