"use client";

import { useActionState, useState } from "react";
import { updateUserAssignmentAction } from "./actions";

type StoreOpt = { id: string; name: string; tenant_id: string | null };
type TenantOpt = { id: string; name: string };

export default function UserAssignmentControl({
  userId,
  role,
  tenantId,
  currentStoreId,
  stores,
  tenants,
  isPlatformAdmin,
}: {
  userId: string;
  role: string;
  tenantId: string | null;
  currentStoreId: string | null;
  stores: StoreOpt[];
  tenants: TenantOpt[];
  isPlatformAdmin: boolean;
}) {
  const [selectedTenant, setSelectedTenant] = useState(tenantId ?? "");
  const [state, action, pending] = useActionState(updateUserAssignmentAction, {
    error: undefined,
  });

  // Only offer stores that belong to the user's (selected) tenant.
  const visibleStores = selectedTenant
    ? stores.filter((s) => s.tenant_id === selectedTenant)
    : stores;

  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="role" value={role} />
      {isPlatformAdmin && (
        <select
          name="tenant_id"
          value={selectedTenant}
          onChange={(e) => setSelectedTenant(e.target.value)}
          aria-label="Tenant"
          className="rounded-lg border border-black/10 px-2 py-1 text-xs dark:border-white/10 dark:bg-transparent"
        >
          <option value="">— no tenant —</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
      <select
        name="store_id"
        defaultValue={currentStoreId ?? ""}
        key={selectedTenant}
        aria-label="Store"
        className="rounded-lg border border-black/10 px-2 py-1 text-xs dark:border-white/10 dark:bg-transparent"
      >
        <option value="">— no store —</option>
        {visibleStores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-black/10 px-2.5 py-1 text-xs text-neutral-600 hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state.error && (
        <span className="w-full text-right text-xs text-red-600 dark:text-red-400">
          {state.error}
        </span>
      )}
    </form>
  );
}
