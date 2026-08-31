import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <main className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Perfume IMS</h1>
        <p className="max-w-md text-lg text-neutral-600 dark:text-neutral-400">
          Multi-store inventory management system for your perfume business.
        </p>
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-neutral-200 p-6 text-sm dark:border-neutral-800">
          <p className="font-semibold">Getting started checklist:</p>
          <ol className="list-decimal space-y-1 text-left text-neutral-600 dark:text-neutral-400">
            <li>Create a project at supabase.com</li>
            <li>
              Run <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">sql/001_schema.sql</code> then{" "}
              <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">sql/002_rls_policies.sql</code> in the
              Supabase SQL editor
            </li>
            <li>
              Copy <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">.env.local.example</code> to{" "}
              <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">.env.local</code> and fill in your keys
            </li>
            <li>
              Restart <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">npm run dev</code>
            </li>
          </ol>
        </div>
        <Link
          href="/login"
          className="mt-4 rounded-full bg-foreground px-6 py-2 text-sm font-medium text-background transition-colors hover:opacity-80"
        >
          Go to Login
        </Link>
      </main>
    </div>
  );
}
