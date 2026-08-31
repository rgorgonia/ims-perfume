import { unstable_cache } from "next/cache";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AttributeInputType = "select" | "text" | "number" | "boolean" | "date";

export interface Category {
  id: string;
  slug: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

export interface CategoryAttributeDefinition {
  id: string;
  category_id: string;
  attribute_key: string;
  label: string;
  input_type: AttributeInputType;
  options: string[] | null;
  required: boolean;
  sort_order: number;
}

export interface Taxonomy {
  categories: Category[];
  /** attribute definitions grouped by category slug, sorted */
  attributesByCategory: Record<string, CategoryAttributeDefinition[]>;
}

export interface GlobalConfig {
  businessName: string;
  currencySymbol: string;
  currencyLocale: string;
}

/** Variant attribute payload — values validated by the DB trigger. */
export type VariantAttributes = Record<string, string | number | boolean>;

// ---------------------------------------------------------------------------
// Client: a dedicated anon client. unstable_cache cannot use the @supabase/ssr
// cookie-bound client (cookies() is dynamic). Taxonomy/config are public
// catalog metadata (RLS: read-all), so anon reads are correct here.
// ---------------------------------------------------------------------------

let publicClient: SupabaseClient | null = null;

function getPublicClient(): SupabaseClient {
  if (!publicClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Missing Supabase URL/anon key");
    publicClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return publicClient;
}

// ---------------------------------------------------------------------------
// Cached reads — tag-based invalidation ("taxonomy" / "config")
// ---------------------------------------------------------------------------

export const getTaxonomy = unstable_cache(
  async (): Promise<Taxonomy> => {
    const supabase = getPublicClient();

    const [catsRes, defsRes] = await Promise.all([
      supabase
        .from("product_categories")
        .select("id, slug, label, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("category_attribute_definitions")
        .select(
          "id, category_id, attribute_key, label, input_type, options, required, sort_order"
        )
        .order("sort_order"),
    ]);
    if (catsRes.error) throw catsRes.error;
    if (defsRes.error) throw defsRes.error;

    const categories = (catsRes.data ?? []) as Category[];
    const defs = (defsRes.data ?? []) as CategoryAttributeDefinition[];

    const attributesByCategory: Record<string, CategoryAttributeDefinition[]> = {};
    for (const d of defs) {
      const cat = categories.find((c) => c.id === d.category_id);
      if (!cat) continue;
      (attributesByCategory[cat.slug] ??= []).push(d);
    }

    return { categories, attributesByCategory };
  },
  ["taxonomy"],
  { tags: ["taxonomy"], revalidate: 3600 }
);

export const getGlobalConfig = unstable_cache(
  async (): Promise<GlobalConfig> => {
    const { data, error } = await getPublicClient()
      .from("app_settings")
      .select("key, value")
      .in("key", ["business_name", "currency_symbol", "currency_locale"]);
    if (error) throw error;

    const map = new Map((data ?? []).map((r) => [r.key, r.value]));
    return {
      businessName: map.get("business_name") || "My Business",
      currencySymbol: map.get("currency_symbol") || "₱",
      currencyLocale: map.get("currency_locale") || "en-PH",
    };
  },
  ["global-config"],
  { tags: ["config"], revalidate: 3600 }
);
