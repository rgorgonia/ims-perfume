import { cookies } from "next/headers";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { ACTIVE_STORE_COOKIE } from "@/lib/store-cookie";
import type { Session } from "@/lib/auth";

export type StoreOption = { id: string; name: string };

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

/**
 * Stores the signed-in user may operate on — mirrors the role scoping used by
 * Inventory:
 *   - a bound user (owner with an assigned store, or a store manager) sees only
 *     that store;
 *   - a tenant-bound user (owner without an assigned store) sees their tenant's
 *     stores;
 *   - a platform admin (no tenant) sees every store.
 */
export async function getAccessibleStores(
  session: Session,
  supabase: ServerSupabase
): Promise<StoreOption[]> {
  const boundStoreId = session.profile?.store_id ?? null;
  const q = supabase.from("stores").select("id, name").order("name");
  if (boundStoreId) {
    q.eq("id", boundStoreId);
  } else if (!session.isPlatformAdmin && session.tenant_id) {
    q.eq("tenant_id", session.tenant_id);
  }
  const { data } = await q;
  return (data ?? []) as StoreOption[];
}

/**
 * The currently active store id (or null for "All stores"), validated against
 * the stores the user can actually see so a stale/crafted cookie can't filter
 * into an inaccessible store.
 */
export async function getActiveStore(
  accessible: StoreOption[]
): Promise<string | null> {
  const cookieStore = await cookies();
  const val = cookieStore.get(ACTIVE_STORE_COOKIE)?.value ?? null;
  if (!val || val === "all") return null;
  return accessible.some((s) => s.id === val) ? val : null;
}