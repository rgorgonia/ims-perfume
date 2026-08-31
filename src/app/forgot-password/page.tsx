"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/theme-toggle";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-8">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
      <main className="soft w-full max-w-sm space-y-6 rounded-[18px] p-8">
        <h1 className="text-2xl font-bold">Forgot password</h1>

        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600 dark:text-slate-300">
              If an account exists for <span className="font-medium">{email}</span>,
              a password reset link has been sent. Check your inbox (and spam
              folder) and follow the link to set your new password.
            </p>
            <Link href="/login" className="block text-sm font-medium underline underline-offset-4">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <p className="text-sm text-neutral-600 dark:text-slate-300">
              Enter your work email and we&apos;ll send you a link to set your password.
            </p>
            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-[10px] border border-black/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-400 dark:border-neutral-700 dark:bg-transparent"
              />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl btn-neon py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
            <Link href="/login" className="block text-center text-sm underline underline-offset-4">
              Back to sign in
            </Link>
          </form>
        )}
      </main>
    </div>
  );
}
