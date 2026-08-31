import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AppSettings = {
  businessName: string;
  currencySymbol: string;
  currencyLocale: string;
  sizeUnit: string;
  categories: string[];
  /** Per-category options for the secondary dropdown (e.g. concentration). */
  categoryOptions: Record<string, string[]>;
  perfumeFeatures: boolean;
};

const DEFAULTS: AppSettings = {
  businessName: "My Business",
  currencySymbol: "₱",
  currencyLocale: "en-PH",
  sizeUnit: "ml",
  categories: ["Fragrance", "Body care", "Home scent", "Cosmetic", "Accessory"],
  categoryOptions: { Fragrance: ["EDT", "EDP", "EXTRAIT", "EDC", "OIL"] },
  perfumeFeatures: true,
};

/** Read the editable system settings, falling back to defaults. Server-side.
 *  React cache(): deduped per request (layout + page share one DB read). */
export const getSettings: () => Promise<AppSettings> = cache(async function () {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("key, value");
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));

  const cats = (map.get("product_categories") ?? "")
    .split(",")
    .map((c: string) => c.trim())
    .filter(Boolean);

  // Parse the per-category options JSON; ignore malformed entries.
  let categoryOptions = DEFAULTS.categoryOptions;
  try {
    const parsed = JSON.parse(map.get("category_options") ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const clean: Record<string, string[]> = {};
      for (const [cat, opts] of Object.entries(parsed)) {
        if (Array.isArray(opts)) {
          const list = opts.map(String).map((o) => o.trim()).filter(Boolean);
          if (list.length) clean[cat] = list;
        }
      }
      categoryOptions = clean;
    }
  } catch {
    // fall back to defaults on invalid JSON
  }

  return {
    businessName: map.get("business_name") || DEFAULTS.businessName,
    currencySymbol: map.get("currency_symbol") || DEFAULTS.currencySymbol,
    currencyLocale: map.get("currency_locale") || DEFAULTS.currencyLocale,
    sizeUnit: map.get("size_unit") || DEFAULTS.sizeUnit,
    categories: cats.length ? cats : DEFAULTS.categories,
    categoryOptions,
    perfumeFeatures: (map.get("perfume_features") ?? "on") !== "off",
  };
});

/** Format a money amount with the configured currency. */
export function formatMoney(
  n: number,
  symbol: string,
  locale: string
): string {
  return `${symbol}${Number(n ?? 0).toLocaleString(locale, {
    maximumFractionDigits: 2,
  })}`;
}
