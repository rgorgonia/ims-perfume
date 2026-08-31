import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AppSettings = {
  businessName: string;
  currencySymbol: string;
  currencyLocale: string;
  sizeUnit: string;
  categories: string[];
  perfumeFeatures: boolean;
};

const DEFAULTS: AppSettings = {
  businessName: "My Business",
  currencySymbol: "₱",
  currencyLocale: "en-PH",
  sizeUnit: "ml",
  categories: ["Fragrance", "Body care", "Home scent", "Cosmetic", "Accessory"],
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

  return {
    businessName: map.get("business_name") || DEFAULTS.businessName,
    currencySymbol: map.get("currency_symbol") || DEFAULTS.currencySymbol,
    currencyLocale: map.get("currency_locale") || DEFAULTS.currencyLocale,
    sizeUnit: map.get("size_unit") || DEFAULTS.sizeUnit,
    categories: cats.length ? cats : DEFAULTS.categories,
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
