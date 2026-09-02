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
 * Assign a store owner and/or inventory manager.
 * - Owner sees everything for the store (incl. revenue + capital).
 * - Inventory manager(s) manage stock & sales only — no revenue.
 * - The same user may hold both (owner wins → they see everything).
 * - At most one owner per store: the previous owner is demoted to
 *   inventory manager of the same store.
 */
async function assignStaff(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string,
  formData: FormData
): Promise<string | null> {
  const ownerId = String(formData.get("owner_user_id") ?? "");
  const managerId = String(formData.get("manager_user_id") ?? "");
  if (!ownerId && !managerId) return null;

  const bind = async (userId: string, storeRole: "owner" | "manager") => {
    const { error } = await supabase
      .from("profiles")
      .update({ store_id: storeId, role: "store_manager", store_role: storeRole })
      .eq("id", userId);
    if (error) throw new Error(error.message);
  };

  try {
    // Demote the previous owner (if any) before the unique index would trip.
    const { data: prevOwners } = await supabase
      .from("profiles")
      .select("id")
      .eq("store_id", storeId)
      .eq("role", "store_manager")
      .eq("store_role", "owner");
    for (const p of (prevOwners ?? []) as { id: string }[]) {
      if (ownerId && p.id !== ownerId) {
        const { error } = await supabase
          .from("profiles")
          .update({ store_role: "manager" })
          .eq("id", p.id);
        if (error) throw new Error(error.message);
      }
    }

    if (ownerId) await bind(ownerId, "owner");
    if (managerId && managerId !== ownerId) await bind(managerId, "manager");
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Manager assignment failed";
  }
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

  const assignError = await assignStaff(supabase, store.id, formData);
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

  const assignError = await assignStaff(supabase, id, formData);
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
