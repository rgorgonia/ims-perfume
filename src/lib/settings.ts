import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient as createPublicClient } from "@supabase/supabase-js";

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

/** Shared anon client for cached reads (unstable_cache cannot use the
 *  cookie-bound SSR client). app_settings is public-read under RLS. */
let settingsClient: ReturnType<typeof createPublicClient> | null = null;
function getSettingsClient() {
  if (!settingsClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Missing Supabase URL/anon key");
    settingsClient = createPublicClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return settingsClient;
}

const getCachedSettings = unstable_cache(
  // Plain object (not Map): unstable_cache serializes the return value,
  // and Map is not JSON-serializable -> would throw at render time.
  async (): Promise<Record<string, string>> => {
    const { data } = await getSettingsClient()
      .from("app_settings")
      .select("key, value");
    return Object.fromEntries(
      ((data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value])
    );
  },
  ["app-settings"],
  { tags: ["config"], revalidate: 3600 }
);

/** Read the editable system settings, falling back to defaults. Server-side.
 *  unstable_cache: one DB read per hour max, invalidated via revalidateTag("config")
 *  (config save actions). React cache(): deduped per request. */
export const getSettings: () => Promise<AppSettings> = cache(async function () {
  const map = new Map(Object.entries(await getCachedSettings()));

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
