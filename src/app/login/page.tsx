export default function Login() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <main className="w-full max-w-sm space-y-6 rounded-2xl border border-neutral-200 p-8 dark:border-neutral-800">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Authentication will connect to Supabase Auth once environment
          variables are configured.
        </p>
        <form className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-400 dark:border-neutral-700 dark:bg-transparent"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-400 dark:border-neutral-700 dark:bg-transparent"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-foreground py-2 text-sm font-medium text-background transition-opacity hover:opacity-80"
          >
            Sign in
          </button>
        </form>
      </main>
    </div>
  );
}
