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
  const tier = String(formData.get("subscription_tier") ?? "starter");
  const maxStores = Number(formData.get("max_stores") ?? "") || null;
  const maxUsers = Number(formData.get("max_users") ?? "") || null;

  if (!businessName || !ownerEmail || !ownerName)
    return { error: "Business name, owner name and owner email are required." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail))
    return { error: "Owner email is not valid." };
  if (!["starter", "growth", "enterprise"].includes(tier))
    return { error: "Invalid subscription tier." };

  const supabase = await createClient();
  // Slug is an explicit input (spec Phase 1); auto-slugify only as a default.
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const slug = slugify(rawSlug || businessName);
  if (!slug) return { error: "Slug must contain letters or numbers." };

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

  // 2. Tenant + owner profile + optional first store — ONE atomic RPC
  //    (migration 013). Any failure rolls back completely server-side;
  //    we then delete the auth user so zero partial state remains.
  const { data: tenantId, error: rpcError } = await supabase.rpc(
    "provision_tenant",
    {
      p_owner_id: created.user.id,
      p_business_name: businessName,
      p_slug: slug,
      p_owner_name: ownerName,
      p_first_store: firstStore || null,
      p_tier: tier,
      p_max_stores: maxStores,
      p_max_users: maxUsers,
    }
  );
  if (rpcError || !tenantId) {
    await admin.auth.admin.deleteUser(created.user.id);
    const msg = rpcError?.message ?? "Could not create the tenant.";
    return {
      error: /limit reached/i.test(msg)
        ? `Subscription limit rejected the provisioning: ${msg}`
        : msg,
    };
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
