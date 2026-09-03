"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/theme-toggle";

const inputCls =
  "w-full rounded-[10px] border border-black/10 bg-white/60 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500/60 focus:ring-2 focus:ring-neutral-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setPending(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-8">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
      <main className="soft w-full max-w-sm space-y-6 rounded-[18px] p-8">
        <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Reset your password</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-slate-400">
          Enter your account email and we&apos;ll send you a reset link.
        </p>
      </div>

      {sent ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          If an account exists for <strong>{email}</strong>, a reset link is on
          its way. Check your inbox (and spam folder).
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="you@business.ph"
              autoComplete="email"
            />
          </label>
          {error && (
            <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <p className="text-center text-sm">
        <Link
          href="/login"
          className="font-medium text-neutral-600 underline underline-offset-4 hover:text-neutral-900 dark:text-slate-400 dark:hover:text-white"
        >
          ← Back to sign in
        </Link>
      </p>
        </div>
      </main>
    </div>
  );
}
