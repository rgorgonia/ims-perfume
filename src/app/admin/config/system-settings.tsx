"use client";

import { useActionState } from "react";
import { updateSystemSettingsAction } from "@/app/actions";
import type { AppSettings } from "@/lib/settings";

const inputCls =
  "w-full rounded-[10px] border border-black/10 bg-white/60 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500/60 focus:ring-2 focus:ring-neutral-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white";

export default function SystemSettings({ s }: { s: AppSettings }) {
  const [result, formAction, pending] = useActionState(
    updateSystemSettingsAction,
    {} as { error?: string; success?: string }
  );

  return (
    <section className="soft rounded-[18px] p-6">
      <h2 className="mb-1 text-[15px] font-semibold">System</h2>
      <p className="mb-4 text-xs text-neutral-500 dark:text-slate-400">
        Business-wide defaults applied across the whole app. Product categories
        and their attribute fields are managed in the{" "}
        <span className="font-medium">Taxonomy &amp; attributes</span> tab.
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
          <p className="text-xs text-neutral-500 dark:text-slate-400">
            Shown in the sidebar, browser tab, and as the logo letter.
          </p>
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
          <p className="text-xs text-neutral-500 dark:text-slate-400">
            Prefixes every price — sales, capital, catalog.
          </p>
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
          <p className="text-xs text-neutral-500 dark:text-slate-400">
            Controls thousand separators and decimals (e.g. 1,234.56).
          </p>
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
          <p className="text-xs text-neutral-500 dark:text-slate-400">
            Unit for product size on catalog and inventory (e.g. 50 ml).
          </p>
        </div>
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
