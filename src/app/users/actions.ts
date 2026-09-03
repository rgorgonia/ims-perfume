"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePrivileged } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type RegisterResult = {
  error?: string;
  email?: string;
  tempPassword?: string;
};

/** Readable temp password, e.g. "K7mP-2xQ9-tR4w" — shown once. */
function generateTempPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = () => chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length];
  return [3, 4, 4].map((n) => Array.from({ length: n }, pick).join("")).join("-");
}

const DEFAULT_TEMP_PASSWORD = "password123";

/**
 * Assign a tenant and/or store to an existing user.
 *
 * - Platform admins may set both tenant and store on any user.
 * - Tenant owners may only manage users inside their own tenant (store only;
 *   the tenant select is hidden for them).
 * - The store must belong to the user's (new) tenant. Changing a user's
 *   tenant clears a store that no longer belongs to them.
 * - Roles are not changed here; role changes happen via register/disable
 *   flows only.
 */
export async function updateUserAssignmentAction(
  prev: { error?: string },
  formData: FormData
) {
  const session = await requirePrivileged();
  const supabase = await createClient();

  const userId = String(formData.get("user_id") ?? "").trim();
  const storeId = String(formData.get("store_id") ?? "").trim();
  if (!userId) return { error: "Missing user" };

  const { data: user } = await supabase
    .from("profiles")
    .select("role, tenant_id")
    .eq("id", userId)
    .single();
  if (!user) return { error: "User not found" };

  const isPlatformAdmin = session.isPlatformAdmin;

  // Tenant owners can only touch managers/owners within their own tenant.
  if (!isPlatformAdmin) {
    if (!session.tenant_id || user.tenant_id !== session.tenant_id) {
      return { error: "User not found in your tenant" };
    }
  }

  // Resolve the target tenant: platform admins may move the user to another
  // tenant; everyone else keeps the user's current tenant.
  let targetTenantId = user.tenant_id;
  if (isPlatformAdmin) {
    targetTenantId = String(formData.get("tenant_id") ?? "").trim() || null;
  }

  // Validate the store belongs to the target tenant.
  let finalStoreId: string | null = storeId || null;
  if (finalStoreId) {
    const { data: store } = await supabase
      .from("stores")
      .select("tenant_id")
      .eq("id", finalStoreId)
      .single();
    if (!store) return { error: "Selected store does not exist" };
    if (!targetTenantId || store.tenant_id !== targetTenantId) {
      return { error: "Selected store belongs to a different tenant" };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ tenant_id: targetTenantId, store_id: finalStoreId })
    .eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/users");
  revalidatePath("/stores");
  return { error: undefined };
}

/**
 * Permanently delete a user (profile + auth account, cascade).
 * Platform admins may delete any non-admin user; tenant owners may only
 * delete store managers inside their own tenant.
 */
export async function deleteUserAction(formData: FormData) {
  const session = await requirePrivileged();
  const userId = String(formData.get("user_id") ?? "").trim();
  if (!userId || userId === session.user.id) return;

  const supabase = await createClient();
  const { data: user } = await supabase
    .from("profiles")
    .select("role, tenant_id")
    .eq("id", userId)
    .single();
  if (!user) return;
  if (user.role === "platform_admin") return;
  if (!session.isPlatformAdmin) {
    if (user.role !== "store_manager") return; // owners can only remove managers
    if (!session.tenant_id || user.tenant_id !== session.tenant_id) return;
  }

  // auth.users delete cascades to profiles (profiles_id_fkey ON DELETE CASCADE).
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("deleteUser failed:", error.message);
    return;
  }

  revalidatePath("/users");
  revalidatePath("/stores");
}

export async function resetUserPasswordAction(formData: FormData) {
  await requirePrivileged();
  const userId = String(formData.get("user_id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!userId) return;

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: DEFAULT_TEMP_PASSWORD,
  });
  if (error) return;

  revalidatePath("/users");
  redirect(`/users?reset=${encodeURIComponent(email)}`);
}

const STORE_TYPES = ["physical", "online", "kiosk", "warehouse"] as const;

/**
 * Validate an existing store assignment: the store must belong to the tenant
 * the user is being created under. Returns an error message or null.
 */
async function validateStoreTenant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string,
  tenantId: string | null
): Promise<string | null> {
  if (!storeId) return null;
  const { data: store } = await supabase
    .from("stores")
    .select("tenant_id")
    .eq("id", storeId)
    .single();
  if (!store) return "Selected store does not exist";
  if (!tenantId || store.tenant_id !== tenantId) {
    return "Selected store belongs to a different tenant";
  }
  return null;
}

/**
 * Create a store inline during user registration, including its
 * configuration (address, store type, categories sold).
 */
async function createInlineStore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  tenantId: string
): Promise<{ id?: string; error?: string }> {
  const name = String(formData.get("new_store_name") ?? "").trim();
  if (!name) return { error: "New store name is required" };
  const address = String(formData.get("new_store_address") ?? "").trim();
  const typeRaw = String(formData.get("new_store_type") ?? "physical");
  const storeType = (STORE_TYPES as readonly string[]).includes(typeRaw) ? typeRaw : "physical";
  const categories = formData
    .getAll("new_store_categories")
    .map((c) => String(c).trim())
    .filter(Boolean);

  // Enforce the tenant's max_stores subscription limit (defense in depth —
  // the DB trigger also enforces this).
  const { data: limits } = await supabase
    .from("tenants")
    .select("max_stores")
    .eq("id", tenantId)
    .single();
  if (limits?.max_stores != null) {
    const { count } = await supabase
      .from("stores")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    if ((count ?? 0) >= limits.max_stores) {
      return {
        error: `Tenant limit reached: subscription allows at most ${limits.max_stores} stores`,
      };
    }
  }

  const { data: store, error } = await supabase
    .from("stores")
    .insert({
      name,
      address: address || null,
      store_type: storeType,
      categories: categories.length ? categories : null,
      tenant_id: tenantId,
    })
    .select("id")
    .single();
  if (error || !store) return { error: error?.message ?? "Could not create the store" };
  return { id: store.id };
}

export async function registerUserAction(
  _prev: RegisterResult,
  formData: FormData
): Promise<RegisterResult> {
  const session = await requirePrivileged();
  const isPlatformAdmin = session.isPlatformAdmin;

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "store_manager");
  const storeId = String(formData.get("store_id") ?? "");
  const storeMode = String(formData.get("store_mode") ?? "existing");

  if (!fullName || !email) return { error: "Name and email are required" };

  // Platform admins may create tenant owners (no tenant_id) or store managers
  // under a chosen tenant. Tenant owners may only create store managers in
  // their own tenant.
  let finalRole: string = role;
  let tenantId: string | null = session.tenant_id ?? null;
  if (isPlatformAdmin) {
    if (role === "platform_admin") {
      return { error: "Create owner or manager accounts; platform admins are managed in the database" };
    }
    // A platform admin can place a store_manager under a chosen tenant via form.
    tenantId = String(formData.get("tenant_id") ?? "") || null;
  } else {
    finalRole = "store_manager";
    tenantId = session.tenant_id; // tenant owner's own tenant
  }

  const supabase = await createClient();

  // Resolve the store assignment. A store manager must end up bound to
  // exactly one store in their own tenant.
  let finalStoreId: string | null = null;
  if (finalRole === "store_manager") {
    if (storeMode === "new") {
      if (!tenantId) {
        return { error: "Choose a tenant before creating a new store" };
      }
      const created = await createInlineStore(supabase, formData, tenantId);
      if (created.error || !created.id) {
        return { error: created.error ?? "Could not create the store" };
      }
      finalStoreId = created.id;
    } else if (storeId) {
      const storeError = await validateStoreTenant(supabase, storeId, tenantId);
      if (storeError) return { error: storeError };
      finalStoreId = storeId;
    }
  }

  const tempPassword = generateTempPassword();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    return { error: error?.message ?? "Could not create the auth user" };
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    full_name: fullName,
    role: finalRole,
    tenant_id: tenantId,
    store_id: finalRole === "store_manager" ? finalStoreId : null,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: profileError.message };
  }
  // If the store was created inline but the user insert failed above, the
  // store remains — that is acceptable (an empty configured store), unlike an
  // orphaned auth user.

  revalidatePath("/users");
  revalidatePath("/stores");
  return { email, tempPassword };
}