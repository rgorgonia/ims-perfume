import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Session cookie: no persistent maxAge → the browser deletes the auth
      // cookies when it closes, logging the user out automatically.
      cookieOptions: { maxAge: undefined },
    }
  );
}

