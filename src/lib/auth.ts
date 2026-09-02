import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type UserRole = "platform_admin" | "tenant_owner" | "store_manager";

export type Profile = {
  full_name: string;
  role: UserRole;
  /** Organization the user belongs to; NULL only for a global platform_admin. */
  tenant_id: string | null;
  /** Assigned store — only meaningful for store_manager. */
  store_id: string | null;
  is_active: boolean;
};

export type Session = {
  user: { id: string; email: string };
  profile: Profile | null;
  /** Resolved operating tenant: the user's tenant, or the first visible tenant
   *  for a global platform_admin working inside an operational page. */
  tenant_id: string | null;
  isPlatformAdmin: boolean;
  isTenantOwner: boolean;
  isStoreManager: boolean;
};

/** Returns the signed-in user + their profile + a resolved tenant context. */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, tenant_id, store_id, is_active")
    .eq("id", user.id)
    .single();

  const p = (profile as Profile) ?? null;
  const isPlatformAdmin = p?.role === "platform_admin";
  const isTenantOwner = p?.role === "tenant_owner";
  const isStoreManager = p?.role === "store_manager";

  // Resolve the tenant a global platform_admin is operating inside. They can
  // read every tenant row; pick the first one so operational pages render.
  let tenantId = p?.tenant_id ?? null;
  if (!tenantId && isPlatformAdmin) {
    const { data } = await supabase
      .from("tenants")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    tenantId = (data as { id: string } | null)?.id ?? null;
  }

  return {
    user: { id: user.id, email: user.email ?? "" },
    profile: p,
    tenant_id: tenantId,
    isPlatformAdmin,
    isTenantOwner,
    isStoreManager,
  };
}

/** Server-side guard: redirect to /login unless signed in. */
export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Server-side guard: redirect non-privileged users (store managers) to /. */
export async function requirePrivileged(): Promise<Session> {
  const session = await requireUser();
  if (!session.isPlatformAdmin && !session.isTenantOwner) redirect("/");
  return session;
}

/** @deprecated Alias for requirePrivileged (platform_admin or tenant_owner). */
export async function requireAdmin(): Promise<Session> {
  return requirePrivileged();
}

/** Server-side guard: platform super admins only (global console). */
export async function requirePlatformAdmin(): Promise<Session> {
  const session = await requireUser();
  if (!session.isPlatformAdmin) redirect("/");
  return session;
}
