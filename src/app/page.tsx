import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <main className="w-full max-w-md space-y-6 rounded-2xl border border-neutral-200 p-8 dark:border-neutral-800">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Perfume IMS</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Signed in successfully
          </p>
        </div>

        <dl className="space-y-3 rounded-lg bg-neutral-100 p-4 text-sm dark:bg-neutral-900">
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-600 dark:text-neutral-400">Email</dt>
            <dd className="font-medium break-all">{user.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-600 dark:text-neutral-400">Name</dt>
            <dd className="font-medium">{profile?.full_name ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-600 dark:text-neutral-400">Role</dt>
            <dd className="font-medium capitalize">
              {(profile?.role ?? "no profile row").replace("_", " ")}
            </dd>
          </div>
        </dl>

        {profile?.role !== "system_admin" && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Your account does not have the system_admin role yet. Promote it in
            the Supabase SQL editor:
            <code className="mt-1 block rounded bg-neutral-100 p-2 break-all dark:bg-neutral-900">
              {`update public.profiles set role = 'system_admin' where id = '${user.id}';`}
            </code>
          </p>
        )}

        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-lg bg-foreground py-2 text-sm font-medium text-background transition-opacity hover:opacity-80"
          >
            Sign out
          </button>
        </form>
      </main>
    </div>
  );
}

