"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePrivileged } from "@/lib/auth";
import type { AttributeInputType } from "@/lib/services/taxonomy";

type ActionState = { error?: string; success?: string };

const INPUT_TYPES: AttributeInputType[] = [
  "select",
  "text",
  "number",
  "boolean",
  "date",
];

/** Require a tenant owner or platform admin; returns their tenant context. */
async function requirePrivilegedContext() {
  const supabase = await createClient();
  const session = await requirePrivileged();
  if (!session.tenant_id) return { supabase, tenantId: null };
  return { supabase, tenantId: session.tenant_id };
}

function invalidateConfig() {
  revalidateTag("taxonomy");
  revalidateTag("config");
  revalidatePath("/", "layout");
}

/** Add a dynamic attribute definition to a category (owner/admin only). */
export async function addAttributeDefinitionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, tenantId } = await requirePrivilegedContext();

  const categoryId = String(formData.get("category_id") ?? "");
  const attributeKey = String(formData.get("attribute_key") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_");
  const label = String(formData.get("label") ?? "").trim();
  const inputType = String(formData.get("input_type") ?? "") as AttributeInputType;
  const required = formData.get("required") === "on";
  const sortOrder = Number(formData.get("sort_order") ?? 0);

  if (!tenantId) return { error: "No tenant context" };
  if (!categoryId) return { error: "Category is required" };
  if (!attributeKey) return { error: "Attribute key is required" };
  if (!label) return { error: "Label is required" };
  if (!INPUT_TYPES.includes(inputType)) return { error: "Invalid input type" };

  // select inputs require a non-empty options list
  let options: string[] | null = null;
  if (inputType === "select") {
    options = String(formData.get("options") ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    if (options.length === 0)
      return { error: "Select attributes need at least one option (comma-separated)" };
  }

  const { error } = await supabase
    .from("category_attribute_definitions")
    .insert({
      category_id: categoryId,
      tenant_id: tenantId,
      attribute_key: attributeKey,
      label,
      input_type: inputType,
      options,
      required,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    });

  if (error) return { error: error.message };
  invalidateConfig();
  return { success: `Attribute "${label}" added` };
}

/** Remove an attribute definition (owner/admin only). */
export async function deleteAttributeDefinitionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, tenantId } = await requirePrivilegedContext();

  const id = String(formData.get("definition_id") ?? "");
  if (!id) return { error: "Definition id is required" };

  let query = supabase.from("category_attribute_definitions").delete().eq("id", id);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { error } = await query;

  if (error) return { error: error.message };
  invalidateConfig();
  return { success: "Attribute removed" };
}

/** Update a category's label, sort order, or active state (owner/admin only). */
export async function updateCategoryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, tenantId } = await requirePrivilegedContext();

  const id = String(formData.get("category_id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const sortOrder = Number(formData.get("sort_order") ?? 0);
  const isActive = formData.get("is_active") === "on";
  if (!id) return { error: "Category id is required" };
  if (!label) return { error: "Category label is required" };

  let query = supabase.from("product_categories").update({
    label,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    is_active: isActive,
  }).eq("id", id);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { error } = await query;

  if (error) return { error: error.message };
  invalidateConfig();
  return { success: `Category "${label}" updated` };
}

/** Delete a category and its attribute definitions (owner/admin only).
 *  Variants keep their JSONB values but the keys become undeclared. */
export async function deleteCategoryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, tenantId } = await requirePrivilegedContext();

  const id = String(formData.get("category_id") ?? "");
  if (!id) return { error: "Category id is required" };

  let query = supabase.from("product_categories").delete().eq("id", id);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { error } = await query;

  if (error) return { error: error.message };
  invalidateConfig();
  return { success: "Category deleted" };
}

/** Update an attribute definition (owner/admin only). */
export async function updateAttributeDefinitionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, tenantId } = await requirePrivilegedContext();

  const id = String(formData.get("definition_id") ?? "");
  if (!id) return { error: "Definition id is required" };

  const label = String(formData.get("label") ?? "").trim();
  const inputType = String(formData.get("input_type") ?? "") as AttributeInputType;
  const required = formData.get("required") === "on";
  const sortOrder = Number(formData.get("sort_order") ?? 0);
  if (!label) return { error: "Label is required" };
  if (!INPUT_TYPES.includes(inputType)) return { error: "Invalid input type" };

  let options: string[] | null = null;
  if (inputType === "select") {
    options = String(formData.get("options") ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    if (options.length === 0)
      return { error: "Select attributes need at least one option (comma-separated)" };
  }

  let query = supabase
    .from("category_attribute_definitions")
    .update({
      label,
      input_type: inputType,
      options,
      required,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    })
    .eq("id", id);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { error } = await query;

  if (error) return { error: error.message };
  invalidateConfig();
  return { success: `Attribute "${label}" updated` };
}

/** Add a new product category (owner/admin only). */
export async function addCategoryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, tenantId } = await requirePrivilegedContext();
  if (!tenantId) return { error: "No tenant context" };

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Category label is required" };

  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) return { error: "Category label must contain letters or numbers" };

  const { data: cat, error } = await supabase
    .from("product_categories")
    .insert({ slug, label, tenant_id: tenantId })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Seed starter attribute definitions so variant forms render fields and
  // variants carry contents (attributes JSONB) out of the box. Mirrors the
  // 018_taxonomy_attribute_seed.sql backfill.
  const defs: Record<string, unknown>[] = [
    {
      category_id: cat.id,
      tenant_id: tenantId,
      attribute_key: "notes",
      label: "Notes",
      input_type: "text",
      options: null,
      required: false,
      sort_order: 10,
    },
  ];
  if (/(fragrance|perfume|cologne)/.test(slug)) {
    defs.unshift({
      category_id: cat.id,
      tenant_id: tenantId,
      attribute_key: "concentration",
      label: "Concentration",
      input_type: "select",
      options: ["EDT", "EDP", "Parfum", "EdC"],
      required: false,
      sort_order: 0,
    });
    defs.push({
      category_id: cat.id,
      tenant_id: tenantId,
      attribute_key: "scent_family",
      label: "Scent family",
      input_type: "select",
      options: ["Floral", "Woody", "Oriental", "Fresh", "Gourmand"],
      required: false,
      sort_order: 1,
    });
  }
  await supabase.from("category_attribute_definitions").insert(defs);

  invalidateConfig();
  return { success: `Category "${label}" added` };
}
