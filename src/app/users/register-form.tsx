"use client";

import { useActionState, useState } from "react";
import { registerUserAction } from "./actions";

const inputCls =
  "rounded-[10px] border border-black/10 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-transparent";

export default function RegisterForm({
  stores,
  tenants,
  isPlatformAdmin,
  categories,
}: {
  stores: { id: string; name: string; tenant_id: string | null }[];
  tenants: { id: string; name: string }[];
  isPlatformAdmin: boolean;
  categories: { slug: string; label: string }[];
}) {
  const [result, formAction, pending] = useActionState(registerUserAction, {});
  const [copied, setCopied] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [storeMode, setStoreMode] = useState<"existing" | "new">("existing");

  const visibleStores = tenantId
    ? stores.filter((s) => s.tenant_id === tenantId)
    : stores;

  async function copyPassword() {
    if (!result.tempPassword) return;
    await navigator.clipboard.writeText(result.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 dark:border-neutral-800 dark:bg-transparent">
        <div className="space-y-1">
          <label htmlFor="rf-name" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Full name</label>
          <input id="rf-name" name="full_name" required placeholder="Full name" className={inputCls} />
        </div>
        <div className="space-y-1">
          <label htmlFor="rf-email" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Email</label>
          <input id="rf-email" name="email" type="email" required placeholder="email@example.com" className={inputCls} />
        </div>
        <div className="space-y-1">
          <label htmlFor="rf-role" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Role</label>
          <select id="rf-role" name="role" className={inputCls}>
            <option value="store_manager">Store Manager</option>
            {isPlatformAdmin && <option value="tenant_owner">Tenant Owner</option>}
          </select>
        </div>
        {isPlatformAdmin && (
          <div className="space-y-1">
            <label htmlFor="rf-tenant" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Tenant</label>
            <select id="rf-tenant" name="tenant_id" className={inputCls} value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
              <option value="">No tenant (platform-wide)</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1">
          <label htmlFor="rf-store-mode" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Store</label>
          <select
            id="rf-store-mode"
            className={inputCls}
            value={storeMode}
            onChange={(e) => setStoreMode(e.target.value as "existing" | "new")}
          >
            <option value="existing">Assign existing store</option>
            <option value="new">Create new store…</option>
          </select>
        </div>
        {storeMode === "existing" ? (
          <div className="space-y-1">
            <label htmlFor="rf-store" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Store assignment</label>
            <select id="rf-store" name="store_id" className={inputCls}>
              <option value="">No store assigned</option>
              {visibleStores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <input type="hidden" name="store_mode" value="new" />
            <div className="space-y-1">
              <label htmlFor="rf-new-store-name" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">New store name</label>
              <input id="rf-new-store-name" name="new_store_name" required placeholder="Store name" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label htmlFor="rf-new-store-address" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">New store address</label>
              <input id="rf-new-store-address" name="new_store_address" placeholder="Address (optional)" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label htmlFor="rf-new-store-type" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Store type</label>
              <select id="rf-new-store-type" name="new_store_type" className={inputCls}>
                <option value="physical">Physical</option>
                <option value="online">Online</option>
                <option value="kiosk">Kiosk</option>
                <option value="warehouse">Warehouse</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Categories sold</span>
              <div className="flex flex-wrap gap-3">
                {categories.map((c) => (
                  <label key={c.slug} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" name="new_store_categories" value={c.slug} />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-2xl btn-neon px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50 sm:col-span-2"
        >
          {pending ? "Creating…" : "Create user"}
        </button>
      </form>

      {result.error && (
        <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {result.error}
        </p>
      )}

      {result.tempPassword && (
        <div className="space-y-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            User created! Temporary password for {result.email}:
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <code className="rounded-lg bg-white px-3 py-1.5 text-base font-mono font-semibold tracking-wide dark:bg-neutral-900">
              {result.tempPassword}
            </code>
            <button
              type="button"
              onClick={copyPassword}
              className="rounded-full border border-emerald-400 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
            Shown only once — share it with the user privately (in person or by
            phone, not email). They can log in with it immediately and should
            change it on the Settings page.
          </p>
        </div>
      )}
    </div>
  );
}
