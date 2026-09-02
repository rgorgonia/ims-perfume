import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient as createPublicClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

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

const getCachedPlatformSettings = unstable_cache(
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

/** Parse a raw settings map (with picks) into a typed AppSettings. */
function normalize(
  map: Map<string, string>,
  businessName?: string | null,
  currencySymbol?: string | null,
  currencyLocale?: string | null,
  sizeUnit?: string | null
): AppSettings {
  const cats = (map.get("product_categories") ?? "")
    .split(",")
    .map((c: string) => c.trim())
    .filter(Boolean);

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
    /* fall back to defaults on invalid JSON */
  }

  return {
    businessName: businessName || map.get("business_name") || DEFAULTS.businessName,
    currencySymbol: currencySymbol || map.get("currency_symbol") || DEFAULTS.currencySymbol,
    currencyLocale: currencyLocale || map.get("currency_locale") || DEFAULTS.currencyLocale,
    sizeUnit: sizeUnit || map.get("size_unit") || DEFAULTS.sizeUnit,
    categories: cats.length ? cats : DEFAULTS.categories,
    categoryOptions,
    perfumeFeatures: (map.get("perfume_features") ?? "on") !== "off",
  };
}

/**
 * Tenant-aware system settings. When a tenant_id is supplied (the normal case
 * for a signed-in user), branding/currency/locale/size come from that tenant's
 * tenant_settings row; the shared catalog (categories/category_options) still
 * falls back to platform app_settings. React cache() keeps it per-request.
 */
export const getSettings: (
  tenantId?: string | null
) => Promise<AppSettings> = cache(async function (tenantId?: string | null) {
  if (tenantId) {
    try {
      const supabase = await createServerClient();
      const { data } = await supabase
        .from("tenant_settings")
        .select("business_name, currency_symbol, currency_locale, size_unit")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      const platform = new Map(Object.entries(await getCachedPlatformSettings()));
      return normalize(
        platform,
        data?.business_name ?? null,
        data?.currency_symbol ?? null,
        data?.currency_locale ?? null,
        data?.size_unit ?? null
      );
    } catch {
      /* fall through to platform-level defaults */
    }
  }

  const map = new Map(Object.entries(await getCachedPlatformSettings()));
  return normalize(map);
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
