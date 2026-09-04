"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  createStoreAction,
  updateStoreAction,
  deleteStoreAction,
  type StoreActionState,
} from "./actions";

type Cat = { slug: string; label: string };
type UserOpt = {
  id: string;
  full_name: string;
  role: string;
  store_id: string | null;
  tenant_id: string | null;
};

type StoreT = {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  categories: string[] | null;
  store_type: string;
  tenant_id: string;
  config?: {
    business_name: string | null;
    currency_symbol: string | null;
    currency_locale: string | null;
    size_unit: string | null;
  } | null;
};

const STORE_TYPES: [string, string][] = [
  ["physical", "Physical store"],
  ["online", "Online shop"],
  ["kiosk", "Kiosk / mall cart"],
  ["warehouse", "Warehouse"],
];

const inputCls =
  "rounded-[10px] border border-black/10 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-transparent";
const btnCls =
  "rounded-full px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50";
const primaryBtn = `btn-neon ${btnCls}`;
const ghostBtn =
  "rounded-full border border-black/[0.08] px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-black/[0.05] dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10";
const dangerBtn =
  "rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950";

function CategoryCheckboxes({
  taxonomy,
  selected,
}: {
  taxonomy: Cat[];
  selected: string[] | null;
}) {
  const chosen = new Set(selected ?? []);
  return (
    <fieldset className="space-y-1">
      <legend className="text-xs font-medium">
        Categories sold{" "}
        <span className="font-normal text-neutral-500">
          — none checked = sells everything
        </span>
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {taxonomy.map((c) => (
          <label
            key={c.slug}
            className="flex items-center gap-1.5 text-sm text-neutral-700 dark:text-slate-300"
          >
            <input
              type="checkbox"
              name="categories"
              value={c.slug}
              defaultChecked={chosen.has(c.slug)}
              className="h-4 w-4"
            />
            {c.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Store type + staff assignment controls, shared by create and edit forms. */
function StoreTypeAndManager({
  users,
  storeType,
  managerIds,
  tenantId,
}: {
  users: UserOpt[];
  storeType?: string;
  managerIds?: string[];
  /** Only offer managers from this tenant (store's tenant / selected tenant). */
  tenantId?: string;
}) {
  const chosen = new Set(managerIds ?? []);
  // Only store_manager users of the relevant tenant are assignable.
  const managers = users.filter(
    (u) =>
      u.role === "store_manager" &&
      (!tenantId || !u.tenant_id || u.tenant_id === tenantId)
  );
  return (
    <>
      <label className="space-y-1 block">
        <span className="text-xs font-medium">Store type</span>
        <select name="store_type" defaultValue={storeType ?? "physical"} className={`${inputCls} w-full`}>
          {STORE_TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="space-y-1">
        <legend className="text-xs font-medium">
          Store managers{" "}
          <span className="font-normal text-neutral-500">
            — no revenue visibility; pick all that apply
          </span>
        </legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {managers.length === 0 && (
            <span className="text-xs text-neutral-500">
              No store managers yet — create some on the Users page.
            </span>
          )}
          {managers.map((u) => (
            <label
              key={u.id}
              className="flex items-center gap-1.5 text-sm text-neutral-700 dark:text-slate-300"
            >
              <input
                type="checkbox"
                name="manager_users"
                value={u.id}
                defaultChecked={chosen.has(u.id)}
                className="h-4 w-4"
              />
              {u.full_name}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-xs text-neutral-500 dark:text-slate-400">
        A store manager is bound to exactly one store — other stores&apos; data
        stays private. They can be reassigned from the Users page.
      </p>
    </>
  );
}

function Msg({ state }: { state: StoreActionState }) {
  if (!state.error && !state.success) return null;
  return (
    <p
      className={`text-xs ${
        state.error
          ? "text-red-600 dark:text-red-400"
          : "text-emerald-600 dark:text-emerald-400"
      }`}
    >
      {state.error ?? state.success}
    </p>
  );
}

/** Per-store configuration fields — stored on the store's own settings row. */
function StoreConfigFields({
  config,
  idPrefix,
}: {
  config?: StoreT["config"];
  idPrefix: string;
}) {
  return (
    <fieldset className="space-y-2 rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
      <legend className="text-xs font-medium px-1">
        Configuration{" "}
        <span className="font-normal text-neutral-500">
          — exclusive to this store
        </span>
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-biz`} className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Business name</label>
          <input id={`${idPrefix}-biz`} name="business_name" defaultValue={config?.business_name ?? ""} placeholder="Leave blank to fall back" className={inputCls} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-cur`} className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Currency symbol</label>
          <input id={`${idPrefix}-cur`} name="currency_symbol" defaultValue={config?.currency_symbol ?? ""} placeholder="e.g. ₱, $" className={inputCls} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-loc`} className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Currency locale</label>
          <input id={`${idPrefix}-loc`} name="currency_locale" defaultValue={config?.currency_locale ?? ""} placeholder="e.g. en-PH" className={inputCls} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-unit`} className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Size unit</label>
          <input id={`${idPrefix}-unit`} name="size_unit" defaultValue={config?.size_unit ?? ""} placeholder="e.g. ml" className={inputCls} />
        </div>
      </div>
      <p className="text-xs text-neutral-500 dark:text-slate-400">
        Applies only to this store — other stores keep their own. Blank fields
        fall back to the tenant-wide defaults.
      </p>
    </fieldset>
  );
}

/** One store row: inline edit form + two-click delete. */
export function StoreRow({
  store,
  taxonomy,
  users,
}: {
  store: StoreT;
  taxonomy: Cat[];
  users: UserOpt[];
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [upd, updAction, updPending] = useActionState(updateStoreAction, {});
  const [del, delAction, delPending] = useActionState(deleteStoreAction, {});
  const members = users.filter((u) => u.store_id === store.id && u.role === "store_manager");
  const managers = members;
  const typeLabel = STORE_TYPES.find(([v]) => v === store.store_type)?.[1] ?? store.store_type;

  if (editing) {
    return (
      <form
        action={updAction}
        className="w-full space-y-3 border-b border-neutral-200 p-4 dark:border-neutral-800"
      >
        <input type="hidden" name="store_id" value={store.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor={`se-name-${store.id}`} className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Store name *</label>
            <input id={`se-name-${store.id}`} name="name" required defaultValue={store.name} placeholder="Store name *" className={inputCls} />
          </div>
          <div className="space-y-1">
            <label htmlFor={`se-addr-${store.id}`} className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Address (optional)</label>
            <input id={`se-addr-${store.id}`} name="address" defaultValue={store.address ?? ""} placeholder="Address (optional)" className={inputCls} />
          </div>
        </div>
        <StoreTypeAndManager
          users={users}
          storeType={store.store_type}
          managerIds={managers.map((m) => m.id)}
          tenantId={store.tenant_id}
        />
        <CategoryCheckboxes taxonomy={taxonomy} selected={store.categories} />
        <StoreConfigFields config={store.config} idPrefix={`se-${store.id}`} />
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={store.is_active}
            className="h-4 w-4"
          />
          Active (inactive stores are hidden from the sales form)
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={updPending} className={primaryBtn}>
            {updPending ? "Saving…" : "Save changes"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className={ghostBtn}>
            Cancel
          </button>
          <Msg state={upd} />
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 p-4 dark:border-neutral-800">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {store.name}
          {!store.is_active && <span className="ml-2 text-xs text-red-500">inactive</span>}
        </p>
        <p className="truncate text-xs text-neutral-500 dark:text-slate-400">
          {typeLabel}
          {store.address ? ` · ${store.address}` : ""}
          {!store.categories || store.categories.length === 0
            ? " · All categories"
            : ` · ${store.categories.join(", ")}`}
        </p>
        <p className="text-xs text-neutral-500 dark:text-slate-400">
          {members.length === 0
            ? "No store managers assigned"
            : members
                .map((m) => `👤 ${m.full_name}`)
                .join(" · ")}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {members.length > 0 && (
            <Link href="/users" className="text-neutral-500 underline underline-offset-2 hover:text-neutral-900 dark:text-slate-400 dark:hover:text-white">
              Manage staff
            </Link>
          )}
          <Link href="/products" className="text-neutral-500 underline underline-offset-2 hover:text-neutral-900 dark:text-slate-400 dark:hover:text-white">
            Products
          </Link>
          <Link href="/admin/config" className="text-neutral-500 underline underline-offset-2 hover:text-neutral-900 dark:text-slate-400 dark:hover:text-white">
            Taxonomy
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setEditing(true)} className={ghostBtn}>
          Edit
        </button>
        {confirmDelete ? (
          <>
            <span className="text-xs text-red-600 dark:text-red-400">Delete this store?</span>
            <form action={delAction} className="contents">
              <input type="hidden" name="store_id" value={store.id} />
              <button type="submit" disabled={delPending} className={dangerBtn}>
                {delPending ? "Deleting…" : "Yes, delete"}
              </button>
            </form>
            <button type="button" onClick={() => setConfirmDelete(false)} className={ghostBtn}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className={dangerBtn}>
            Delete
          </button>
        )}
        <div className="w-full">
          <Msg state={del} />
        </div>
      </div>
    </div>
  );
}

/**
 * Full create-store form (client — wires useActionState feedback).
 * Two steps: fill in the details, then review them in a confirmation modal
 * before the store is actually created. Store configuration (business name,
 * currency, size unit) is intentionally NOT part of creation — add it later
 * via the Edit button on the store row so every store keeps its own config.
 */
export function CreateStoreForm({
  taxonomy,
  users,
  tenants,
}: {
  taxonomy: Cat[];
  users: UserOpt[];
  tenants?: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createStoreAction, {});
  // Track the chosen tenant so the manager checkbox list only offers staff
  // that can actually be assigned (assignment is tenant-validated server-side).
  const [selectedTenant, setSelectedTenant] = useState<string | undefined>(tenants?.[0]?.id);
  const formRef = useRef<HTMLFormElement>(null);
  const [reviewing, setReviewing] = useState(false);
  const [draft, setDraft] = useState<null | {
    name: string;
    address: string;
    store_type: string;
    tenant: string;
    categories: string[];
    managers: string[];
  }>(null);

  function openReview() {
    const form = formRef.current;
    if (!form) return;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const fd = new FormData(form);
    setDraft({
      name: String(fd.get("name") ?? "").trim(),
      address: String(fd.get("address") ?? "").trim(),
      store_type: String(fd.get("store_type") ?? "physical"),
      tenant: String(fd.get("tenant_id") ?? "").trim() || (tenants?.[0]?.id ?? ""),
      categories: fd.getAll("categories").map(String),
      managers: fd.getAll("manager_users").map(String),
    });
    setReviewing(true);
  }

  function confirmCreate() {
    formRef.current?.requestSubmit(); // submits the real form → createStoreAction
  }

  // Close the review modal once a store has been created successfully.
  useEffect(() => {
    if (state?.success) setReviewing(false);
  }, [state?.success]);

  const draftTypeLabel =
    STORE_TYPES.find(([v]) => v === draft?.store_type)?.[1] ?? draft?.store_type ?? "";
  const draftTenantName = tenants?.find((t) => t.id === draft?.tenant)?.name ?? "";
  const draftManagerLabels = draft
    ? users
        .filter((u) => draft.managers.includes(u.id))
        .map((u) => u.full_name)
    : [];
  const draftCatLabels = draft
    ? draft.categories.length
      ? draft.categories.map((c) => taxonomy.find((x) => x.slug === c)?.label ?? c)
      : []
    : [];

  return (
    <>
      <form
        ref={formRef}
      action={action}
      className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-transparent"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="sn-name" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Store name *</label>
          <input id="sn-name" name="name" required placeholder="Store name *" className={inputCls} />
        </div>
        <div className="space-y-1">
          <label htmlFor="sn-addr" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Address (optional)</label>
          <input id="sn-addr" name="address" placeholder="Address (optional)" className={inputCls} />
        </div>
      </div>
      {tenants && tenants.length > 0 && (
        <label className="space-y-1 block">
          <span className="text-xs font-medium">Tenant</span>
          <select
            name="tenant_id"
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
            className={`${inputCls} w-full`}
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <StoreTypeAndManager users={users} tenantId={selectedTenant} />
      <CategoryCheckboxes taxonomy={taxonomy} selected={null} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={openReview}
          className="rounded-2xl btn-neon px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
        >
          Review &amp; confirm store
        </button>
        <Msg state={state} />
      </div>
    </form>

    {reviewing && draft && (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
        onClick={() => setReviewing(false)}
      >
        <div
          className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl sm:rounded-3xl dark:border-neutral-800 dark:bg-[#17171a]"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-review-title"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 id="create-review-title" className="text-base font-semibold">
                Review new store
              </h3>
              <p className="text-xs text-neutral-500 dark:text-slate-400">
                Confirm these details before creating the store.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReviewing(false)}
              aria-label="Close review"
              className="rounded-full p-1.5 text-neutral-500 hover:bg-black/[0.05] dark:text-slate-400 dark:hover:bg-white/10"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <dl className="divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
            <SummaryRow label="Store name" value={draft.name} />
            <SummaryRow label="Address" value={draft.address || "None"} />
            <SummaryRow label="Store type" value={draftTypeLabel} />
            {tenants && tenants.length > 0 && (
              <SummaryRow label="Tenant" value={draftTenantName || "—"} />
            )}
            <SummaryRow
              label="Categories sold"
              value={draftCatLabels.length ? draftCatLabels.join(", ") : "All (sells everything)"}
            />
            <SummaryRow
              label="Assigned managers"
              value={draftManagerLabels.length ? draftManagerLabels.join(", ") : "None"}
            />
          </dl>

          <p className="mt-4 rounded-xl bg-neutral-100 px-3 py-2.5 text-xs text-neutral-500 dark:bg-white/5 dark:text-slate-400">
            Store configuration (business name, currency, size unit) is set
            later via <span className="font-medium">Edit</span> on the store&apos;s row — each
            store keeps its own config.
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setReviewing(false)}
              className="rounded-full border border-black/[0.08] px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-black/[0.05] dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Back
            </button>
            <button
              type="button"
              onClick={confirmCreate}
              disabled={pending}
              className="rounded-full btn-neon px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {pending ? "Creating…" : "Confirm &amp; create"}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}

/** Read-only detail row inside the review modal. */
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <dt className="shrink-0 font-medium text-neutral-500 dark:text-slate-400">{label}</dt>
      <dd className="text-right text-neutral-900 dark:text-white">{value}</dd>
    </div>
  );
}
