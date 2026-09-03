"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/theme-toggle";

const inputCls =
  "w-full rounded-[10px] border border-black/10 bg-white/60 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500/60 focus:ring-2 focus:ring-neutral-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white";

export default function AuthRecoveryPage() {
  const router = useRouter();
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    // Parse the recovery token Supabase put in the URL hash (e.g.
    // #access_token=...&refresh_token=...&type=recovery). We read it here
    // explicitly (rather than letting the client auto-detect), and exchange it
    // via setSession, so we fully control the flow — no races with the token being
    // cleared by an auto-detection down-page reload.

    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (
      !accessToken ||
      !refreshToken ||
      params.get("type") !== "recovery"
    ) {
      setError("Invalid or expired recovery link. Please request a new one.");
      return;
    }
    const supabase = createClient();
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          setError(error.message || "Could not restore your session.");
          return;
        }
        window.location.hash = "";
        setRecovering(true);
      });
  }, []);

  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }
    // Done: clear the recovery session and return to sign in fresh.
    setDone(true);
    await supabase.auth.signOut().catch(() => {});
    window.location.hash = "";
    setPending(false);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-8">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
<main className="soft w-full max-w-sm space-y-6 rounded-[18px] p-8">
{done ? (
          <div className="space-y-4">
            <h1 className="text-xl font-bold tracking-tight">
              Password updated
            </h1>
            <div
              role="status"
              className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              Your password was changed successfully. You can now sign in with
              your new password.

            </div>
            <Link
              href="/login"
              className="block w-full rounded-2xl btn-neon py-2 text-center text-sm font-medium transition-opacity hover:opacity-80"
            >
              Go to sign in

            </Link>
          </div>
        ) : recovering ? (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Set a new password
              </h1>
              <p className="mt-1 text-sm text-neutral-500 dark:text-slate-400">
                Choose a strong password to secure your account.


              </p>
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <form className="space-y-4" onSubmit={handleReset}>
              <div className="space-y-1">
                <label htmlFor="new_password" className="text-sm font-medium">
                  New password


                </label>
                <input
                  id="new_password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="confirm_password"
                  className="text-sm font-medium"
                >
                  Confirm new password


                </label>
                <input
                  id="confirm_password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className={inputCls}
                />
              </div>
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-2xl btn-neon py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Update password"}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <h1 className="text-xl font-bold tracking-tight">
              Reset your password
            </h1>
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : (
              <p className="text-sm text-neutral-500 dark:text-slate-400">
                Checking your link…
              </p>
            )}
            <Link
              href="/login/forgot"
              className="inline-block text-sm font-medium text-neutral-500 underline underline-offset-4 hover:text-neutral-900 dark:text-slate-400 dark:hover:text-white"
            >
              Request a new recovery link

            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
