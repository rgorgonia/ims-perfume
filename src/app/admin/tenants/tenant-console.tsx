"use client";

import { useActionState, useState } from "react";
import { Building2, Plus, ShieldAlert, ShieldCheck, Copy, Check } from "lucide-react";
import {
  createTenantAction,
  toggleTenantStatusAction,
  type TenantResult,
} from "./actions";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  store_count: number;
  user_count: number;
  sales_30d: number;
};

const inputCls =
  "w-full rounded-[10px] border border-black/10 bg-white/60 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500/60 focus:ring-2 focus:ring-neutral-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white";

export default function TenantConsole({ tenants }: { tenants: TenantRow[] }) {
  const [state, formAction, pending] = useActionState<TenantResult, FormData>(
    createTenantAction,
    {}
  );
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  function copyCreds() {
    if (!state.tempPassword || !state.ownerEmail) return;
    navigator.clipboard.writeText(
      `email: ${state.ownerEmail}\ntemp password: ${state.tempPassword}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-8">
      {/* ---- Provision a new tenant ---- */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-transparent">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Plus className="h-5 w-5" /> Provision a new tenant
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-slate-400">
          Creates the business, its owner account (with a one-time temp
          password), and optionally a first store — atomically; any failure
          rolls the whole provisioning back.
        </p>
        <form action={formAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Business name *</span>
            <input name="business_name" required className={inputCls} placeholder="Acme Fragrances" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">First store (optional)</span>
            <input name="first_store" className={inputCls} placeholder="Acme Flagship — Makati" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Owner name *</span>
            <input name="owner_name" required className={inputCls} placeholder="Jane dela Cruz" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Owner email *</span>
            <input name="owner_email" type="email" required className={inputCls} placeholder="jane@acme.ph" />
          </label>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
            >
              {pending ? "Provisioning…" : "Create tenant"}
            </button>
            {state.error && (
              <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
                {state.error}
              </p>
            )}
          </div>
        </form>

        {state.success && state.tempPassword && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-950/40"
          >
            <p className="font-medium text-emerald-800 dark:text-emerald-300">
              {state.success}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-emerald-900 dark:text-emerald-200">
              <code className="rounded-md bg-emerald-100 px-2 py-1 dark:bg-emerald-900/60">
                {state.ownerEmail} · {state.tempPassword}
              </code>
              <button
                type="button"
                onClick={copyCreds}
                className="inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy credentials"}
              </button>
            </div>
            <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
              This password is shown once. Share it securely and have the owner
              change it after first sign-in.
            </p>
          </div>
        )}
      </section>

      {/* ---- Tenant list ---- */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Building2 className="h-5 w-5" /> Tenants ({tenants.length})
        </h2>
        {tenants.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-slate-400">
            No tenants yet — provision the first one above.
          </p>
        ) : (
          <TenantTable tenants={tenants} confirming={confirming} setConfirming={setConfirming} />
        )}
      </section>
    </div>
  );
}

function TenantTable({
  tenants,
  confirming,
  setConfirming,
}: {
  tenants: TenantRow[];
  confirming: string | null;
  setConfirming: (id: string | null) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-transparent">
      <table className="w-full text-sm">
        <thead className="bg-neutral-100 text-left dark:bg-neutral-900">
          <tr>
            <th className="px-4 py-2">Business</th>
            <th className="px-4 py-2 text-center">Stores</th>
            <th className="px-4 py-2 text-center">Users</th>
            <th className="px-4 py-2 text-right">Sales (30d)</th>
            <th className="px-4 py-2 text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((t) => (
            <tr key={t.id} className="border-t border-neutral-200 dark:border-neutral-800">
              <td className="px-4 py-3">
                <span className="font-medium">{t.name}</span>
                <span className="block text-xs text-neutral-400">/{t.slug}</span>
              </td>
              <td className="px-4 py-3 text-center">{t.store_count}</td>
              <td className="px-4 py-3 text-center">{t.user_count}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                ₱{t.sales_30d.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </td>
              <td className="px-4 py-3 text-right">
                {confirming === t.id ? (
                  <span className="inline-flex items-center gap-2 text-xs">
                    {t.is_active ? "Suspend this tenant?" : "Re-activate?"}
                    <form action={toggleTenantStatusAction} className="inline">
                      <input type="hidden" name="tenant_id" value={t.id} />
                      <input type="hidden" name="next_active" value={String(!t.is_active)} />
                      <button
                        type="submit"
                        className={`rounded-full px-3 py-1 font-medium text-white ${
                          t.is_active ? "bg-red-600" : "bg-emerald-600"
                        }`}
                      >
                        Confirm
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="rounded-full border border-neutral-300 px-3 py-1 dark:border-neutral-700"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(t.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                      t.is_active
                        ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                        : "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                    }`}
                  >
                    {t.is_active ? (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldAlert className="h-3.5 w-3.5" />
                    )}
                    {t.is_active ? "Active" : "Suspended"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
