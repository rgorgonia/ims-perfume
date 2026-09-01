"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type StoreActionState = { error?: string; success?: string };

function parseCategories(formData: FormData): string[] | null {
  const categories = formData.getAll("categories").map(String);
  return categories.length ? categories : null;
}

export async function createStoreAction(
  _prev: StoreActionState,
  formData: FormData
): Promise<StoreActionState> {
  const session = await requireAdmin();
  void session;
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  if (!name) return { error: "Store name is required" };

  const { error } = await supabase.from("stores").insert({
    name,
    address: address || null,
    categories: parseCategories(formData),
  });
  if (error) return { error: error.message };

  revalidatePath("/stores");
  return { success: `Store "${name}" created` };
}

export async function updateStoreAction(
  _prev: StoreActionState,
  formData: FormData
): Promise<StoreActionState> {
  await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get("store_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const isActive = formData.get("is_active") === "on";
  if (!id) return { error: "Store id is required" };
  if (!name) return { error: "Store name is required" };

  const { error } = await supabase
    .from("stores")
    .update({
      name,
      address: address || null,
      is_active: isActive,
      categories: parseCategories(formData),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/stores");
  return { success: `Store "${name}" updated` };
}

export async function deleteStoreAction(
  _prev: StoreActionState,
  formData: FormData
): Promise<StoreActionState> {
  await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get("store_id") ?? "");
  if (!id) return { error: "Store id is required" };

  const { data: store } = await supabase
    .from("stores")
    .select("name")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("stores").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/stores");
  return { success: `Store "${store?.name ?? id}" deleted` };
}
