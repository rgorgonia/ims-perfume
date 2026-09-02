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
 * Manage a store's full membership from the create/edit form.
 * - owner_user_id: single store owner (sees revenue + capital).
 * - manager_users: any number of inventory managers (no revenue).
 * - The same user can be both (owner wins → they see everything).
 * - A user is bound to exactly ONE store: selecting them here moves them here,
 *   and unchecking someone bound to this store unassigns them.
 * - An existing owner is auto-demoted to inventory manager when replaced.
 * NOTE: role is never rewritten — an assigned system_admin stays an admin.
 */
async function applyMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string,
  formData: FormData
): Promise<string | null> {
  const ownerId = String(formData.get("owner_user_id") ?? "").trim();
  const managerIds = formData.getAll("manager_users").map(String).filter(Boolean);
  const target = new Set<string>();
  if (ownerId) target.add(ownerId);
  managerIds.forEach((id) => target.add(id));

  const set = (userId: string, patch: Record<string, unknown>) =>
    supabase.from("profiles").update(patch).eq("id", userId);

  try {
    // 1) Unassign anyone bound to this store who is no longer selected.
    const { data: members } = await supabase
      .from("profiles")
      .select("id, store_role")
      .eq("store_id", storeId);
    for (const m of (members ?? []) as { id: string; store_role: string }[]) {
      if (!target.has(m.id)) {
        const { error } = await set(m.id, { store_id: null, store_role: "manager" });
        if (error) throw new Error(error.message);
      }
    }

    // 2) If a new owner is named, demote the previous owner of this store.
    if (ownerId) {
      const { data: prevOwners } = await supabase
        .from("profiles")
        .select("id")
        .eq("store_id", storeId)
        .eq("store_role", "owner");
      for (const p of (prevOwners ?? []) as { id: string }[]) {
        if (p.id !== ownerId) {
          const { error } = await set(p.id, { store_role: "manager" });
          if (error) throw new Error(error.message);
        }
      }
      const { error } = await set(ownerId, { store_id: storeId, store_role: "owner" });
      if (error) throw new Error(error.message);
    }

    // 3) Add / refresh inventory managers.
    for (const mid of managerIds) {
      if (mid === ownerId) continue;
      const { error } = await set(mid, { store_id: storeId, store_role: "manager" });
      if (error) throw new Error(error.message);
    }
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Store membership update failed";
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

  const assignError = await applyMembership(supabase, store.id, formData);
  if (assignError) {
    return { success: `Store "${name}" created, but user assignment failed: ${assignError}` };
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

  const assignError = await applyMembership(supabase, id, formData);
  if (assignError) {
    return { success: `Store "${name}" updated, but user assignment failed: ${assignError}` };
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
