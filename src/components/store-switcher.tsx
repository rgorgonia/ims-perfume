"use client";

import { useRouter } from "next/navigation";
import { Store } from "lucide-react";
import { ACTIVE_STORE_COOKIE } from "@/lib/store-cookie";

type StoreOption = { id: string; name: string };

/**
 * Global store selector. Persists the pick in a cookie (ACTIVE_STORE_COOKIE,
 * value "all" = every store) and re-renders the server components so every
 * store-scoped tab reflects the chosen store.
 */
export default function StoreSwitcher({
  stores,
  activeStoreId,
}: {
  stores: StoreOption[];
  activeStoreId: string | null;
}) {
  const router = useRouter();
  const value = activeStoreId ?? "all";
  const hidden = stores.length === 0;

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    document.cookie = `${ACTIVE_STORE_COOKIE}=${e.target.value}; path=/; SameSite=Lax`;
    router.refresh();
  }

  if (hidden) return null;

  const selectCls =
    "min-w-0 w-full rounded-lg border border-black/[0.08] bg-black/[0.04] px-2.5 py-1.5 text-[13px] text-neutral-800 focus:border-neutral-500/60 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:focus:border-white/25 dark:focus:bg-white/[0.09]";

  return (
    <label className="flex items-center gap-2 px-2">
      <Store className="h-4 w-4 shrink-0 text-neutral-400 dark:text-slate-500" />
      <select
        value={value}
        onChange={onChange}
        aria-label="Active store"
        title="Filter tabs to a single store"
        className={selectCls}
      >
        <option value="all">All stores</option>
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}