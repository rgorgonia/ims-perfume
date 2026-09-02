"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type RegisterResult = {
  error?: string;
  email?: string;
  tempPassword?: string;
};

/** Readable temp password, e.g. "K7mP-2xQ9-tR4w" — shown to the admin once. */
function generateTempPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = () => chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length];
  return [3, 4, 4].map((n) => Array.from({ length: n }, pick).join("")).join("-");
}

/** Default password an admin resets a user to. The user should change it in Settings. */
const DEFAULT_TEMP_PASSWORD = "password123";

/**
 * Reassign a user to a different store (or leave a store entirely) from the
 * Users page. Empty store_id = remove from store. The role column is preserved
 * (an admin stays an admin); only store_id + store_role change.
 * If the user is made the owner of another store, the previous owner of that
 * store is demoted to inventory manager (keeps one-owner-per-store).
 */
export async function reassignUserAction(prev: { error?: string }, formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const userId = String(formData.get("user_id") ?? "").trim();
  const storeId = String(formData.get("store_id") ?? "").trim();
  const storeRole =
    String(formData.get("store_role") ?? "manager") === "owner" ? "owner" : "manager";
  if (!userId) return { error: "Missing user" };

  const { data: user } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!user) return { error: "User not found" };
  if (user.role === "system_admin" && storeId) {
    // Allow binding an admin to a store (they keep admin + gain that store's scope).
  }

  try {
    // If assigning as owner, demote the previous owner of the target store.
    if (storeId && storeRole === "owner") {
      const { data: prevOwners } = await supabase
        .from("profiles")
        .select("id")
        .eq("store_id", storeId)
        .eq("store_role", "owner")
        .neq("id", userId);
      for (const p of (prevOwners ?? []) as { id: string }[]) {
        await supabase.from("profiles").update({ store_role: "manager" }).eq("id", p.id);
      }
    }
    const { error } = await supabase.from("profiles").update({
      store_id: storeId || null,
      store_role: storeId ? storeRole : "manager",
    }).eq("id", userId);
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Reassign failed" };
  }

  revalidatePath("/users");
  revalidatePath("/stores");
  return { error: undefined };
}

export async function resetUserPasswordAction(formData: FormData) {
  await requireAdmin();
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
  await requireAdmin();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "store_manager");
  const storeId = String(formData.get("store_id") ?? "");
  const storeRole =
    String(formData.get("store_role") ?? "manager") === "owner" ? "owner" : "manager";

  if (!fullName || !email) return { error: "Name and email are required" };

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
    role,
    store_role: storeRole,
    store_id: role === "store_manager" && storeId ? storeId : null,
  });
  if (profileError) {
    // Roll back the auth user so we don't orphan accounts
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: profileError.message };
  }

  revalidatePath("/users");
  return { email, tempPassword };
}