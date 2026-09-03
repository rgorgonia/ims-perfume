"use server";

import { revalidatePath } from "next/cache";
import { requirePrivileged } from "@/lib/auth";
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
 * Assign store managers to a store (tenant-scoped). A manager is bound to
 * exactly one store; unchecking a currently-assigned one unassigns them.
 * Store owners are tenant-level (they manage every store in the tenant), so
 * there is no per-store owner picker anymore.
 */
async function applyManagerAssignment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  storeId: string,
  formData: FormData
): Promise<string | null> {
  const managerIds = formData.getAll("manager_users").map(String).filter(Boolean);
  const target = new Set(managerIds);

  try {
    // Unassign managers in this tenant/store no longer selected.
    const { data: members } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("store_id", storeId)
      .eq("tenant_id", tenantId);
    for (const m of (members ?? []) as { id: string; role: string }[]) {
      if (m.role === "store_manager" && !target.has(m.id)) {
        const { error } = await supabase
          .from("profiles")
          .update({ store_id: null })
          .eq("id", m.id);
        if (error) throw new Error(error.message);
      }
    }
    // Assign the selected store managers.
    for (const mid of managerIds) {
      const { error } = await supabase
        .from("profiles")
        .update({ store_id: storeId })
        .eq("id", mid)
        .eq("tenant_id", tenantId)
        .eq("role", "store_manager");
      if (error) throw new Error(error.message);
    }
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Store assignment update failed";
  }
}

export async function createStoreAction(
  _prev: StoreActionState,
  formData: FormData
): Promise<StoreActionState> {
  const session = await requirePrivileged();
  if (!session.tenant_id) return { error: "No tenant context" };
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  if (!name) return { error: "Store name is required" };

  // Platform admins may create the store in any tenant; everyone else is
  // pinned to their own. Validate the chosen tenant actually exists.
  let tenantId = session.tenant_id;
  const requested = String(formData.get("tenant_id") ?? "").trim();
  if (requested && session.isPlatformAdmin && requested !== session.tenant_id) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", requested)
      .single();
    if (!tenant) return { error: "Selected tenant not found" };
    tenantId = requested;
  }

  const { data: store, error } = await supabase
    .from("stores")
    .insert({
      name,
      address: address || null,
      categories: parseCategories(formData),
      store_type: parseStoreType(formData),
      tenant_id: tenantId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const assignError = await applyManagerAssignment(
    supabase,
    tenantId,
    store.id,
    formData
  );
  if (assignError) {
    return { success: `Store "${name}" created, but assignment failed: ${assignError}` };
  }

  revalidatePath("/stores");
  revalidatePath("/users");
  return { success: `Store "${name}" created` };
}

export async function updateStoreAction(
  _prev: StoreActionState,
  formData: FormData
): Promise<StoreActionState> {
  const session = await requirePrivileged();
  if (!session.tenant_id) return { error: "No tenant context" };
  const supabase = await createClient();

  const id = String(formData.get("store_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const isActive = formData.get("is_active") === "on";
  if (!id) return { error: "Store id is required" };
  if (!name) return { error: "Store name is required" };

  // Resolve the store's own tenant: platform admins may edit any tenant's
  // store; everyone else only stores inside their own tenant.
  const { data: existing } = await supabase
    .from("stores")
    .select("tenant_id")
    .eq("id", id)
    .single();
  if (!existing) return { error: "Store not found" };
  const storeTenantId = existing.tenant_id as string;
  if (!session.isPlatformAdmin && storeTenantId !== session.tenant_id) {
    return { error: "Store not found in your tenant" };
  }

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

  const assignError = await applyManagerAssignment(
    supabase,
    storeTenantId,
    id,
    formData
  );
  if (assignError) {
    return { success: `Store "${name}" updated, but assignment failed: ${assignError}` };
  }

  revalidatePath("/stores");
  revalidatePath("/users");
  return { success: `Store "${name}" updated` };
}

export async function deleteStoreAction(
  _prev: StoreActionState,
  formData: FormData
): Promise<StoreActionState> {
  await requirePrivileged();
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
