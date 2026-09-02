"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type TenantResult = {
  error?: string;
  success?: string;
  tempPassword?: string;
  ownerEmail?: string;
};

/** Readable temp password, e.g. "K7mP-2xQ9-tR4w" — shown once. */
function generateTempPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = () => chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length];
  return [3, 4, 4].map((n) => Array.from({ length: n }, pick).join("")).join("-");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * Provision a complete tenant in one step: the tenant row, its owner auth
 * account + profile, and (optionally) a first store owned by that tenant.
 * Platform super admins only.
 */
export async function createTenantAction(
  _prev: TenantResult,
  formData: FormData
): Promise<TenantResult> {
  await requirePlatformAdmin();

  const businessName = String(formData.get("business_name") ?? "").trim();
  const ownerEmail = String(formData.get("owner_email") ?? "").trim().toLowerCase();
  const ownerName = String(formData.get("owner_name") ?? "").trim();
  const firstStore = String(formData.get("first_store") ?? "").trim();

  if (!businessName || !ownerEmail || !ownerName)
    return { error: "Business name, owner name and owner email are required." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail))
    return { error: "Owner email is not valid." };

  const supabase = await createClient();
  const slug = slugify(businessName);
  if (!slug) return { error: "Business name must contain letters or numbers." };

  // Unique slug guard (friendly error instead of a raw constraint violation).
  const { data: existing } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return { error: `A tenant with slug "${slug}" already exists.` };

  const tempPassword = generateTempPassword();
  const admin = createAdminClient();

  // 1. Owner auth account (auto-confirmed so the owner can sign in at once).
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: ownerName },
  });
  if (createError || !created?.user)
    return { error: createError?.message ?? "Could not create the owner account." };

  // 2. Tenant row.
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .insert({ name: businessName, slug, is_active: true })
    .select("id")
    .single();
  if (tenantError || !tenant) {
    // Roll back the auth user so we never leave an owner without a tenant.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: tenantError?.message ?? "Could not create the tenant." };
  }

  // 3. Owner profile bound to the new tenant.
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: created.user.id,
    email: ownerEmail,
    full_name: ownerName,
    role: "tenant_owner",
    tenant_id: tenant.id,
    store_id: null,
    is_active: true,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    await supabase.from("tenants").delete().eq("id", tenant.id);
    return { error: profileError.message };
  }

  // 4. Optional first store.
  if (firstStore) {
    const { error: storeError } = await supabase.from("stores").insert({
      name: firstStore,
      tenant_id: tenant.id,
      store_type: "physical",
    });
    if (storeError) {
      // Non-fatal: tenant + owner exist; surface the store failure only.
      revalidatePath("/admin/tenants");
      return {
        success: `Tenant "${businessName}" created, but the store could not be added: ${storeError.message}`,
        tempPassword,
        ownerEmail,
      };
    }
  }

  revalidatePath("/admin/tenants");
  return {
    success: `Tenant "${businessName}" created successfully.`,
    tempPassword,
    ownerEmail,
  };
}

export type PlatformTotals = {
  totalTenants: number;
  activeTenants: number;
  totalStores: number;
  sales30d: number;
};

/** Suspend / re-activate a tenant. Suspended tenants' users keep signing in,
 *  but their data is frozen by the is_active RLS predicate below. */
export async function toggleTenantStatusAction(formData: FormData) {
  await requirePlatformAdmin();
  const supabase = await createClient();

  const tenantId = String(formData.get("tenant_id") ?? "");
  const nextActive = String(formData.get("next_active") ?? "") === "true";
  if (!tenantId) return;

  await supabase.from("tenants").update({ is_active: nextActive }).eq("id", tenantId);
  revalidatePath("/admin/tenants");
}

/** Reset a tenant owner's password to a new one-time temp password, shown once. */
export async function resetOwnerPasswordAction(
  _prev: TenantResult,
  formData: FormData
): Promise<TenantResult> {
  await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "");
  if (!tenantId) return { error: "Missing tenant." };

  const supabase = await createClient();
  const { data: owner } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("tenant_id", tenantId)
    .eq("role", "tenant_owner")
    .maybeSingle();
  if (!owner) return { error: "No tenant owner profile found for this tenant." };

  const tempPassword = generateTempPassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(owner.id, {
    password: tempPassword,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/tenants");
  return {
    success: `Password reset for ${owner.email}.`,
    tempPassword,
    ownerEmail: owner.email,
  };
}
