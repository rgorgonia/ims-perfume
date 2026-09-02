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
 * Reassign a store manager to a different store (or leave a store entirely).
 * Tenant owners and platform admins may do this for their own tenant. An
 * owner cannot be stripped to a store; owner is tenant-level.
 */
export async function reassignUserAction(prev: { error?: string }, formData: FormData) {
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

  // Only touch store managers within the caller's tenant.
  if (user.role !== "store_manager") return { error: "Only store managers can be reassigned" };
  if (session.tenant_id && user.tenant_id !== session.tenant_id) {
    return { error: "User not found in your tenant" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ store_id: storeId || null })
    .eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/users");
  revalidatePath("/stores");
  return { error: undefined };
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

  const supabase = await createClient();
  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    full_name: fullName,
    role: finalRole,
    tenant_id: tenantId,
    store_id: finalRole === "store_manager" && storeId ? storeId : null,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: profileError.message };
  }

  revalidatePath("/users");
  return { email, tempPassword };
}