import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import RegisterForm from "./register-form";
import ResetPasswordButton from "./reset-button";
import { resetUserPasswordAction } from "./actions";

type Store = { id: string; name: string };
type ProfileRow = {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  store_id: string | null;
  stores: { name: string } | null;
};


export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  await requireAdmin();
  const supabase = await createClient();
  const { reset } = await searchParams;

  const [{ data: profiles }, { data: stores }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, is_active, store_id, stores(name)")
      .order("created_at", { ascending: true }),
    supabase.from("stores").select("id, name").order("name"),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      {reset && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          Password for <span className="font-semibold">{reset}</span> has been
          reset to the default temporary password. Tell them to log in with it
          and change it on their Settings page.
        </div>
      )}
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Register user</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          A one-time temporary password is generated and shown to you after
          creation. Share it privately with the new user — they log in with it
          and change it on their Settings page.
        </p>
        <RegisterForm stores={stores ?? []} />
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
                    <div className="flex items-center justify-end gap-3">
                      <ResetPasswordButton
                        action={resetUserPasswordAction}
                        userId={p.id}
                        email={p.full_name}
                      />
                      <form action={toggleActive}>
                        <input type="hidden" name="user_id" value={p.id} />
                        <button
                          type="submit"
                          className="text-xs underline underline-offset-2 hover:opacity-70"
                        >
                          {p.is_active ? "Disable" : "Enable"}
                        </button>
                      </form>
                    </div>
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
