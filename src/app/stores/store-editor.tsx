"use client";

import { useActionState, useState } from "react";
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
          <label htmlFor={`${idPrefix}-biz`} className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Business name (optional)</label>
          <input id={`${idPrefix}-biz`} name="business_name" defaultValue={config?.business_name ?? ""} placeholder="Defaults to tenant-wide" className={inputCls} />
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
        These settings apply only while this store is selected in the store
        switcher; blank fields fall back to the tenant-wide defaults.
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

/** Reusable category checkbox list for the create form. */
export function NewStoreCategories({ taxonomy }: { taxonomy: Cat[] }) {
  return <CategoryCheckboxes taxonomy={taxonomy} selected={null} />;
}

/** Full create-store form (client — wires useActionState feedback). */
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
  return (
    <form
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
      <StoreConfigFields idPrefix="sn" />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-2xl btn-neon px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create store"}
        </button>
        <Msg state={state} />
      </div>
    </form>
  );
}
