"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/theme-toggle";

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // Password set — go sign in with the new credentials.
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-8">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
      <main className="soft w-full max-w-sm space-y-6 rounded-[18px] p-8">
        <h1 className="text-2xl font-bold">Set new password</h1>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              New password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-[10px] border border-black/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-400 dark:border-neutral-700 dark:bg-transparent"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="confirm" className="text-sm font-medium">
              Confirm new password
            </label>
            <input
              id="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-[10px] border border-black/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-400 dark:border-neutral-700 dark:bg-transparent"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl btn-neon py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Set password & sign in"}
          </button>
        </form>
      </main>
    </div>
  );
}
