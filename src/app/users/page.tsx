import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Store = { id: string; name: string };
type ProfileRow = {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  store_id: string | null;
  stores: { name: string } | null;
};

async function registerUser(formData: FormData) {
  "use server";
  await requireAdmin();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "store_manager");
  const storeId = String(formData.get("store_id") ?? "");

  if (!fullName || !email) return;

  // Pattern A (docs/ARCHITECTURE.md §4): temp password the admin never shows;
  // staff sets their own via "Forgot password".
  const tempPassword = crypto.randomUUID();

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) return;

  const supabase = await createClient();
  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    full_name: fullName,
    role,
    store_id: role === "store_manager" && storeId ? storeId : null,
  });
  if (profileError) {
    // Roll back the auth user so we don't orphan accounts
    await admin.auth.admin.deleteUser(data.user.id);
    return;
  }

  revalidatePath("/users");
}


export default async function UsersPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: profiles }, { data: stores }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, is_active, store_id, stores(name)")
      .order("created_at", { ascending: true }),
    supabase.from("stores").select("id, name").order("name"),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Register user</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          A temporary password is generated server-side. The new user should
          use &ldquo;Forgot password&rdquo; on the login page to set their own.
        </p>
        <form
          action={registerUser}
          className="grid gap-3 rounded-2xl border border-neutral-200 bg-white dark:bg-transparent p-4 sm:grid-cols-2 dark:border-neutral-800"
        >
          <input
            name="full_name"
            required
            placeholder="Full name"
            className="rounded-[10px] border border-black/10 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-transparent"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="email@example.com"
            className="rounded-[10px] border border-black/10 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-transparent"
          />
          <select
            name="role"
            className="rounded-[10px] border border-black/10 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-transparent"
          >
            <option value="store_manager">Store Manager</option>
            <option value="system_admin">System Admin</option>
          </select>
          <select
            name="store_id"
            className="rounded-[10px] border border-black/10 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-transparent"
          >
            <option value="">No store (admin)</option>
            {(stores ?? []).map((s: Store) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-2xl btn-neon px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 sm:col-span-2"
          >
            Create user
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">All users</h2>
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:bg-transparent dark:border-neutral-800 dark:bg-transparent">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-left dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Store</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {((profiles ?? []) as unknown as ProfileRow[]).map((p) => (
                <tr key={p.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-4 py-2 font-medium">{p.full_name}</td>
                  <td className="px-4 py-2 capitalize">{p.role.replace("_", " ")}</td>
                  <td className="px-4 py-2">{p.stores?.name ?? "—"}</td>
                  <td className="px-4 py-2">
                    {p.is_active ? "Active" : "Disabled"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <form action={toggleActive}>
                      <input type="hidden" name="user_id" value={p.id} />
                      <button
                        type="submit"
                        className="text-xs underline underline-offset-2 hover:opacity-70"
                      >
                        {p.is_active ? "Disable" : "Enable"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {(profiles ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

async function toggleActive(formData: FormData) {
  "use server";
  const session = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  if (!userId || userId === session.user.id) return;

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", userId)
    .single();
  if (!current) return;

  await supabase
    .from("profiles")
    .update({ is_active: !current.is_active })
    .eq("id", userId);
  revalidatePath("/users");
}
