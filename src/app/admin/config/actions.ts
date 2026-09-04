"use server";

import { revalidatePath } from "next/cache";
import { requirePrivileged } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ImportResult = { error?: string; success?: string };

/** Copy another store's taxonomy (categories + attribute definitions) into
 *  the given store. Rows are duplicated as store-owned (store_id set), so
 *  the source store is unaffected and future edits stay independent. */
export async function importTaxonomyAction(
  _prev: ImportResult,
  formData: FormData
): Promise<ImportResult> {
  const session = await requirePrivileged();
  const supabase = await createClient();

  const targetStoreId = String(formData.get("store_id") ?? "").trim();
  const sourceStoreId = String(formData.get("source_store_id") ?? "").trim();
  if (!targetStoreId || !sourceStoreId || targetStoreId === sourceStoreId)
    return { error: "Pick a store to import from." };

  // Safety: both stores must belong to the caller's tenant (or, for platform
  // admins, at least be visible).
  const { data: target, error: tErr } = await supabase
    .from("stores")
    .select("id, tenant_id")
    .eq("id", targetStoreId)
    .single();
  const { data: source, error: sErr } = await supabase
    .from("stores")
    .select("id, tenant_id")
    .eq("id", sourceStoreId)
    .single();
  if (tErr || sErr || !target || !source)
    return { error: "Store not found or not accessible." };
  if (target.tenant_id !== source.tenant_id)
    return { error: "Stores belong to different businesses — import blocked." };

  const { data: sourceCats, error: cErr } = await supabase
    .from("product_categories")
    .select("slug, label, sort_order, is_active")
    .eq("store_id", sourceStoreId)
    .order("sort_order");
  if (cErr) return { error: cErr.message };

  if (!sourceCats || sourceCats.length === 0)
    return { error: "That store has no store-specific taxonomy to import." };

  const slugToNewId = new Map<string, string>();
  for (const cat of sourceCats) {
    const { data: inserted, error: insErr } = await supabase
      .from("product_categories")
      .insert({
        slug: cat.slug,
        label: cat.label,
        sort_order: cat.sort_order,
        is_active: cat.is_active,
        tenant_id: target.tenant_id,
        store_id: targetStoreId,
      })
      .select("id")
      .single();
    if (insErr) return { error: insErr.message };
    if (inserted) slugToNewId.set(cat.slug, inserted.id);
  }

  // Attribute definitions follow their categories.
  const { data: sourceDefs, error: dErr } = await supabase
    .from("category_attribute_definitions")
    .select(
      "attribute_key, label, input_type, options, required, sort_order, category_id"
    )
    .eq("store_id", sourceStoreId);
  if (dErr) return { error: dErr.message };

  // Map old category_id -> new store-scoped category_id via the source rows.
  const { data: sourceCatIds, error: sidErr } = await supabase
    .from("product_categories")
    .select("id, slug")
    .eq("store_id", sourceStoreId);
  if (sidErr) return { error: sidErr.message };
  const oldCatIdToSlug = new Map(
    (sourceCatIds ?? []).map((c) => [c.id, c.slug])
  );

  const defs = (sourceDefs ?? [])
    .map((d) => {
      const slug = oldCatIdToSlug.get(d.category_id);
      const newCatId = slug ? slugToNewId.get(slug) : undefined;
      if (!newCatId) return null;
      return {
        category_id: newCatId,
        tenant_id: target.tenant_id,
        store_id: targetStoreId,
        attribute_key: d.attribute_key,
        label: d.label,
        input_type: d.input_type,
        options: d.options,
        required: d.required,
        sort_order: d.sort_order,
      };
    })
    .filter(Boolean) as Record<string, unknown>[];

  if (defs.length > 0) {
    const { error: defErr } = await supabase
      .from("category_attribute_definitions")
      .insert(defs);
    if (defErr) return { error: defErr.message };
  }

  revalidatePath("/admin/config");
  revalidatePath("/products");
  return {
    success: `Imported ${sourceCats.length} categories and ${defs.length} attributes into this store.`,
  };
}
