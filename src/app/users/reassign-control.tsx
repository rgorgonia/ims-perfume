"use client";

import { useActionState } from "react";
import { reassignUserAction } from "./actions";

export default function ReassignControl({
  userId,
  stores,
  currentStoreId,
  currentRole,
}: {
  userId: string;
  stores: { id: string; name: string }[];
  currentStoreId: string | null;
  currentRole: string;
}) {
  const [state, action, pending] = useActionState(reassignUserAction, { error: undefined });
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <select
        name="store_id"
        defaultValue={currentStoreId ?? ""}
        className="rounded-lg border border-black/10 px-2 py-1 text-xs dark:border-white/10 dark:bg-transparent"
      >
        <option value="">— none (no store) —</option>
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <select
        name="store_role"
        defaultValue={currentStoreId ? currentRole : "manager"}
        className="rounded-lg border border-black/10 px-2 py-1 text-xs dark:border-white/10 dark:bg-transparent"
      >
        <option value="manager">Inventory manager</option>
        <option value="owner">Store owner</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-black/10 px-2.5 py-1 text-xs text-neutral-600 hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
      >
        Apply
      </button>
      {state.error && (
        <span className="w-full text-xs text-red-600 dark:text-red-400">{state.error}</span>
      )}
    </form>
  );
}