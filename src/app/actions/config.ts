"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AttributeInputType } from "@/lib/services/taxonomy";

type ActionState = { error?: string; success?: string };

const INPUT_TYPES: AttributeInputType[] = [
  "select",
  "text",
  "number",
  "boolean",
  "date",
];

/** Verify the caller is a system_admin; returns the client or null. */
async function requireAdminClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "system_admin") return null;
  return supabase;
}

function invalidateConfig() {
  revalidateTag("taxonomy");
  revalidateTag("config");
  revalidatePath("/", "layout");
}

/** Add a dynamic attribute definition to a category (admins only). */
export async function addAttributeDefinitionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await requireAdminClient();
  if (!supabase) return { error: "Admins only" };

  const categoryId = String(formData.get("category_id") ?? "");
  const attributeKey = String(formData.get("attribute_key") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_");
  const label = String(formData.get("label") ?? "").trim();
  const inputType = String(formData.get("input_type") ?? "") as AttributeInputType;
  const required = formData.get("required") === "on";
  const sortOrder = Number(formData.get("sort_order") ?? 0);

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

/** Remove an attribute definition (admins only). */
export async function deleteAttributeDefinitionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await requireAdminClient();
  if (!supabase) return { error: "Admins only" };

  const id = String(formData.get("definition_id") ?? "");
  if (!id) return { error: "Definition id is required" };

  const { error } = await supabase
    .from("category_attribute_definitions")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  invalidateConfig();
  return { success: "Attribute removed" };
}

/** Add a new product category (admins only). */
export async function addCategoryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await requireAdminClient();
  if (!supabase) return { error: "Admins only" };

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Category label is required" };

  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) return { error: "Category label must contain letters or numbers" };

  const { error } = await supabase
    .from("product_categories")
    .insert({ slug, label });

  if (error) return { error: error.message };
  invalidateConfig();
  return { success: `Category "${label}" added` };
}
