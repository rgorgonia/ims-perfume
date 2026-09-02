"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type StoreActionState = { error?: string; success?: string };

const STORE_TYPES = ["physical", "online", "kiosk", "warehouse"] as const;

function parseCategories(formData: FormData): string[] | null {
  const categories = formData.getAll("categories").map(String);
  return categories.length ? categories : null;
}

function parseStoreType(formData: FormData): string {
  const t = String(formData.get("store_type") ?? "physical");
  return (STORE_TYPES as readonly string[]).includes(t) ? t : "physical";
}

/**
 * Assign the chosen user as this store's manager/owner.
 * Any other manager previously bound to the store is unassigned first
 * (one manager per store). No-op when userId is empty.
 */
async function assignManager(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string,
  formData: FormData
): Promise<string | null> {
  const userId = String(formData.get("manager_user_id") ?? "");
  const storeRole = String(formData.get("store_role") ?? "manager") === "owner" ? "owner" : "manager";
  if (!userId) return null;

  // Unassign anyone else currently bound to this store.
  await supabase
    .from("profiles")
    .update({ store_id: null })
    .eq("store_id", storeId)
    .neq("id", userId);

  const { error } = await supabase
    .from("profiles")
    .update({ store_id: storeId, role: "store_manager", store_role: storeRole })
    .eq("id", userId);
  return error ? error.message : null;
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

  const { data: store, error } = await supabase
    .from("stores")
    .insert({
      name,
      address: address || null,
      categories: parseCategories(formData),
      store_type: parseStoreType(formData),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const assignError = await assignManager(supabase, store.id, formData);
  if (assignError) {
    return { success: `Store "${name}" created, but manager assignment failed: ${assignError}` };
  }

  revalidatePath("/stores");
  revalidatePath("/users");
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
      store_type: parseStoreType(formData),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  const assignError = await assignManager(supabase, id, formData);
  if (assignError) {
    return { success: `Store "${name}" updated, but manager assignment failed: ${assignError}` };
  }

  revalidatePath("/stores");
  revalidatePath("/users");
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
