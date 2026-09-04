"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateProfileAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: "Name cannot be empty" };

  // avatar_url is optional; only accept URLs pointing at this user's own
  // folder in the public avatars bucket (defense against forged values).
  let avatarUrl: string | null = null;
  const rawAvatar = String(formData.get("avatar_url") ?? "").trim();
  if (rawAvatar) {
    const marker = `/object/public/avatars/${user.id}/`;
    if (!rawAvatar.includes(marker)) {
      return { error: "Invalid avatar URL" };
    }
    avatarUrl = rawAvatar;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, avatar_url: avatarUrl })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: "Profile updated" };
}

type SettingsState = { error?: string; success?: string };

/** Update system settings (system admins only). */
export async function updateSystemSettingsAction(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Defense in depth: only platform admins and tenant owners may edit settings.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single();
  const privileged =
    profile?.role === "platform_admin" || profile?.role === "tenant_owner";
  if (!privileged) return { error: "Admins and owners only" };

  // Owners always edit their own tenant's settings; a platform admin edits the
  // tenant they are operating inside, or platform-global settings when no
  // tenant context is present.
  if (profile.role === "tenant_owner" && !profile.tenant_id) {
    return { error: "No tenant context" };
  }

  const businessName = String(formData.get("business_name") ?? "").trim();
  const currencySymbol = String(formData.get("currency_symbol") ?? "").trim();
  const currencyLocale = String(formData.get("currency_locale") ?? "").trim();
  const sizeUnit = String(formData.get("size_unit") ?? "").trim();
  if (!businessName || !currencySymbol || !currencyLocale || !sizeUnit) {
    return { error: "All settings are required" };
  }

  // A globally selected store gets its own settings row, owned by the
  // STORE's tenant (a platform admin without a tenant context may still
  // configure a specific store). "All stores" edits the tenant-wide
  // defaults of the admin's own tenant, or platform settings when none.
  const storeId = String(formData.get("store_id") ?? "").trim() || null;
  let targetTenantId: string | null = profile.tenant_id ?? null;
  if (storeId) {
    const { data: storeRow } = await supabase
      .from("stores")
      .select("tenant_id")
      .eq("id", storeId)
      .maybeSingle();
    if (!storeRow) return { error: "Store not found" };
    if (
      profile.role !== "platform_admin" &&
      storeRow.tenant_id !== profile.tenant_id
    ) {
      return { error: "Store not found in your organization" };
    }
    targetTenantId = storeRow.tenant_id;
  }

  if (targetTenantId) {
    const base = {
      tenant_id: targetTenantId,
      store_id: storeId,
      business_name: businessName,
      currency_symbol: currencySymbol,
      currency_locale: currencyLocale,
      size_unit: sizeUnit,
    };
    const updateQuery = storeId
      ? supabase
          .from("tenant_settings")
          .update(base)
          .eq("store_id", storeId)
          .eq("tenant_id", targetTenantId)
          .select("tenant_id")
      : supabase
          .from("tenant_settings")
          .update(base)
          .is("store_id", null)
          .eq("tenant_id", targetTenantId)
          .select("tenant_id");
    const { data: updated, error: updErr } = await updateQuery;
    if (updErr) return { error: updErr.message };
    if (!updated || updated.length === 0) {
      const { error: insErr } = await supabase
        .from("tenant_settings")
        .insert(base);
      if (insErr) return { error: insErr.message };
    }
  } else {
    const entries: [string, string][] = [
      ["business_name", businessName],
      ["currency_symbol", currencySymbol],
      ["currency_locale", currencyLocale],
      ["size_unit", sizeUnit],
    ];
    const upserts = entries.map(([key, value]) => ({ key, value }));
    const { error } = await supabase
      .from("app_settings")
      .upsert(upserts, { onConflict: "key" });
    if (error) return { error: error.message };
  }

  revalidateTag("config");
  revalidatePath("/", "layout");
  return { success: "Settings saved" };
}
