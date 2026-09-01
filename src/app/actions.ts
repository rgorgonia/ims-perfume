"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

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

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/settings");
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

  // Defense in depth: verify admin role server-side.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "system_admin") return { error: "Admins only" };

  const entries: [string, string][] = [
    ["business_name", String(formData.get("business_name") ?? "").trim()],
    ["currency_symbol", String(formData.get("currency_symbol") ?? "").trim()],
    ["currency_locale", String(formData.get("currency_locale") ?? "").trim()],
    ["size_unit", String(formData.get("size_unit") ?? "").trim()],
    [
      "perfume_features",
      formData.get("perfume_features") === "on" ? "on" : "off",
    ],
  ];

  const upserts = entries
    .filter(([, v]) => v !== "")
    .map(([key, value]) => ({ key, value }));
  if (!upserts.length) return { error: "Nothing to save" };

  const { error } = await supabase
    .from("app_settings")
    .upsert(upserts, { onConflict: "key" });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: "System settings saved" };
}
