import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  full_name: string;
  role: "system_admin" | "store_manager";
  store_role: "manager" | "owner";
  store_id: string | null;
  is_active: boolean;
};

/** Returns the signed-in user + their profile, or null when signed out. */
export async function getSession(): Promise<{
  user: { id: string; email: string };
  profile: Profile | null;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, store_role, store_id, is_active")
    .eq("id", user.id)
    .single();

  return {
    user: { id: user.id, email: user.email ?? "" },
    profile: (profile as Profile) ?? null,
  };
}

/** Server-side guard: redirect to /login unless signed in. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Server-side guard: redirect non-admins to / (defense in depth with middleware). */
export async function requireAdmin() {
  const session = await requireUser();
  if (session.profile?.role !== "system_admin") redirect("/");
  return session;
}
