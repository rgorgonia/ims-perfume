import { cache } from "react";
import { createClient as createServerClient } from "@/lib/supabase/server";

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
// Reads
// ---------------------------------------------------------------------------

function parseTaxonomy(
  categories: Category[],
  defs: CategoryAttributeDefinition[]
): Taxonomy {
  const attributesByCategory: Record<string, CategoryAttributeDefinition[]> = {};
  for (const d of defs) {
    const cat = categories.find((c) => c.id === d.category_id);
    if (!cat) continue;
    (attributesByCategory[cat.slug] ??= []).push(d);
  }
  return { categories, attributesByCategory };
}

/**
 * Read the taxonomy visible in a given scope.
 *  - `storeId` set     → that store's OWN rows only (store-owned taxonomy).
 *  - `storeId` omitted → the tenant-wide shared rows (store_id IS NULL).
 * Store B therefore never sees Store A's categories/attributes unless they
 * were explicitly imported into B. React cache() dedupes per request.
 */
export const getTaxonomy = cache(
  async (tenantId?: string | null, storeId?: string | null): Promise<Taxonomy> => {
    const supabase = await createServerClient();
    const t = tenantId ?? undefined;

    const query = supabase
      .from("product_categories")
      .select("id, slug, label, sort_order, is_active")
      .eq("is_active", true);
    const q2 = supabase
      .from("category_attribute_definitions")
      .select("id, category_id, attribute_key, label, input_type, options, required, sort_order")
      .order("sort_order");

    if (t) {
      query.eq("tenant_id", t);
      q2.eq("tenant_id", t);
    }
    if (storeId) {
      query.eq("store_id", storeId);
      q2.eq("store_id", storeId);
    } else {
      query.is("store_id", null);
      q2.is("store_id", null);
    }

    const [catsR, defsR] = await Promise.all([query, q2]);
    if (catsR.error) throw catsR.error;
    if (defsR.error) throw defsR.error;

    return parseTaxonomy(
      (catsR.data ?? []) as Category[],
      (defsR.data ?? []) as CategoryAttributeDefinition[]
    );
  }
);

export const getGlobalConfig = cache(async (): Promise<GlobalConfig> => {
  const supabase = await createServerClient();
  const { data, error } = await supabase
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
});
