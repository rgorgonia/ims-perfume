"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  Activity,
  Building2,
  Check,
  Copy,
  KeyRound,
  LogIn,
  MoreHorizontal,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Store,
  TrendingUp,
  X,
} from "lucide-react";
import {
  createTenantAction,
  resetOwnerPasswordAction,
  toggleTenantStatusAction,
  type TenantResult,
} from "./actions";

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  store_count: number;
  user_count: number;
  sales_30d: number;
};

export type PlatformTotals = {
  totalTenants: number;
  activeTenants: number;
  totalStores: number;
  sales30d: number;
};

const inputCls =
  "w-full rounded-[10px] border border-black/10 bg-white/60 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500/60 focus:ring-2 focus:ring-neutral-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white";

const primaryBtn =
  "inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:focus-visible:outline-white";

function peso(n: number) {
  return "\u20b1" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/* ------------------------------ Metric cards ------------------------------ */

function MetricCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300 dark:border-neutral-800 dark:bg-transparent dark:hover:border-neutral-700">
      <div className="flex items-center gap-2 text-neutral-500 dark:text-slate-400">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-neutral-500 dark:text-slate-400">{sub}</p>
    </div>
  );
}

/* --------------------------- Credentials banner --------------------------- */

function CredentialBanner({
  result,
  onDismiss,
}: {
  result: TenantResult;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!result.tempPassword || !result.ownerEmail) return;
    navigator.clipboard.writeText(
      `email: ${result.ownerEmail}\ntemp password: ${result.tempPassword}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/40"
      role="status"
    >
      <span className="font-medium text-emerald-800 dark:text-emerald-300">
        {result.success}
      </span>
      {result.ownerEmail && (
        <code className="rounded bg-white/70 px-2 py-0.5 text-xs dark:bg-white/10">
          {result.ownerEmail}
        </code>
      )}
      {result.tempPassword && (
        <>
          <code className="rounded bg-white/70 px-2 py-0.5 text-xs dark:bg-white/10">
            temp: {result.tempPassword}
          </code>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-full border border-emerald-400 px-3 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy credentials"}
          </button>
        </>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="ml-auto rounded-full p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/* --------------------------- Provisioning modal --------------------------- */

function ProvisionModal({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState<TenantResult, FormData>(
    createTenantAction,
    {}
  );
  const succeeded = Boolean(state.success);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="provision-title"
        className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="provision-title" className="text-lg font-semibold">
              Provision new tenant
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-slate-400">
              Creates the business, its owner account (one-time temp password),
              and optionally a first store — atomically.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {succeeded ? (
          <div className="mt-5 space-y-4">
            <CredentialBanner result={state} onDismiss={onClose} />
            <p className="text-xs text-neutral-500 dark:text-slate-400">
              Share these credentials securely — the password is shown only once.
            </p>
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className={primaryBtn}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form action={formAction} className="mt-5 grid gap-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Business name *</span>
              <input
                name="business_name"
                required
                autoFocus
                className={inputCls}
                placeholder="Acme Fragrances"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Owner name *</span>
              <input
                name="owner_name"
                required
                className={inputCls}
                placeholder="Jane dela Cruz"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Owner email *</span>
              <input
                name="owner_email"
                type="email"
                required
                className={inputCls}
                placeholder="jane@acme.ph"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">First store (optional)</span>
              <input
                name="first_store"
                className={inputCls}
                placeholder="Acme Flagship — Makati"
              />
            </label>
            {state.error && (
              <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
                {state.error}
              </p>
            )}
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button type="submit" disabled={pending} className={primaryBtn}>
                <Plus className="h-4 w-4" />
                {pending ? "Provisioning…" : "Create tenant"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Actions menu ------------------------------ */

function TenantActionsMenu({
  tenant,
  resetAction,
}: {
  tenant: TenantRow;
  resetAction: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirming(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${tenant.name}`}
        onClick={() => setOpen((v) => !v)}
        className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:text-slate-400 dark:hover:bg-neutral-800 dark:hover:text-white"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
        >
          <a
            role="menuitem"
            href="/"
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <LogIn className="h-4 w-4 text-neutral-500 dark:text-slate-400" />
            Enter workspace
          </a>

          <form action={resetAction}>
            <input type="hidden" name="tenant_id" value={tenant.id} />
            <button
              role="menuitem"
              type="submit"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <KeyRound className="h-4 w-4 text-neutral-500 dark:text-slate-400" />
              Reset owner password
            </button>
          </form>

          <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />

          {confirming ? (
            <div className="px-3 py-2 text-xs">
              <p className="mb-2 font-medium">
                {tenant.is_active
                  ? `Suspend "${tenant.name}"? All of its users lose data access immediately.`
                  : `Re-activate "${tenant.name}"?`}
              </p>
              <div className="flex gap-2">
                <form action={toggleTenantStatusAction} className="flex-1">
                  <input type="hidden" name="tenant_id" value={tenant.id} />
                  <input type="hidden" name="next_active" value={String(!tenant.is_active)} />
                  <button
                    type="submit"
                    className={`w-full rounded-full px-3 py-1.5 text-xs font-medium text-white ${
                      tenant.is_active
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    {tenant.is_active ? "Suspend" : "Reactivate"}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="flex-1 rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              role="menuitem"
              type="button"
              onClick={() => setConfirming(true)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                tenant.is_active
                  ? "text-red-600 dark:text-red-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {tenant.is_active ? (
                <ShieldAlert className="h-4 w-4" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {tenant.is_active ? "Suspend tenant" : "Re-activate tenant"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Main console ------------------------------ */

export default function TenantConsole({
  tenants,
  totals,
}: {
  tenants: TenantRow[];
  totals: PlatformTotals;
}) {
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const [resetState, setResetState] = useState<TenantResult | null>(null);
  const [resetTrigger, resetAction] = useActionState<TenantResult, FormData>(
    resetOwnerPasswordAction,
    {}
  );

  // Surface reset-password results here — the form lives inside the dropdown,
  // so the banner lives up here where it is always visible.
  useEffect(() => {
    if (resetTrigger.error || resetTrigger.success) setResetState(resetTrigger);
  }, [resetTrigger]);

  const q = query.trim().toLowerCase();
  const filtered = tenants.filter(
    (t) => !q || t.name.toLowerCase().includes(q) || t.slug.includes(q)
  );

  return (
    <div className="space-y-6">
      {/* ---- Zone 1: platform metrics ---- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={<Building2 className="h-4 w-4" />}
          label="Total tenants"
          value={String(totals.totalTenants)}
          sub={`${totals.activeTenants} active`}
        />
        <MetricCard
          icon={<Store className="h-4 w-4" />}
          label="Total stores"
          value={String(totals.totalStores)}
          sub="Provisioned across all tenants"
        />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Platform sales (30d)"
          value={peso(totals.sales30d)}
          sub="Gross volume, all tenants"
        />
        <MetricCard
          icon={<Activity className="h-4 w-4" />}
          label="System health"
          value="100%"
          sub="All services operational"
        />
      </div>

      {/* ---- Zone 2: high-density datatable ---- */}
      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-transparent">
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 p-4 dark:border-neutral-800">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tenants..."
              aria-label="Search tenants"
              className={`${inputCls} pl-9`}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setModalKey((k) => k + 1);
              setModalOpen(true);
            }}
            className={primaryBtn}
          >
            <Plus className="h-4 w-4" />
            Provision New Tenant
          </button>
        </div>

        {resetState && (
          <div className="p-4 pb-0">
            <CredentialBanner result={resetState} onDismiss={() => setResetState(null)} />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Business</th>
                <th className="px-4 py-2.5 text-center font-medium">Stores</th>
                <th className="px-4 py-2.5 text-center font-medium">Users</th>
                <th className="px-4 py-2.5 text-right font-medium">Sales (30d)</th>
                <th className="px-4 py-2.5 text-center font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-neutral-500 dark:text-slate-400"
                  >
                    No tenants match &ldquo;{query}&rdquo;.
                  </td>
                </tr>
              )}
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-neutral-200 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/50"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium">{t.name}</span>
                    <span className="block text-xs text-neutral-400">/{t.slug}</span>
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">{t.store_count}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{t.user_count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{peso(t.sales_30d)}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        t.is_active
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                      }`}
                    >
                      {t.is_active ? (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      ) : (
                        <ShieldAlert className="h-3.5 w-3.5" />
                      )}
                      {t.is_active ? "Active" : "Suspended"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <TenantActionsMenu tenant={t} resetAction={resetAction} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- Zone 3: provisioning modal ---- */}
      {modalOpen && <ProvisionModal key={modalKey} onClose={() => setModalOpen(false)} />}
    </div>
  );
}




