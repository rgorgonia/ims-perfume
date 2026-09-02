"use client";

import { useActionState, useState } from "react";
import {
  createStoreAction,
  updateStoreAction,
  deleteStoreAction,
  type StoreActionState,
} from "./actions";

type Cat = { slug: string; label: string };
type UserOpt = { id: string; full_name: string; role: string; store_role: string; store_id: string | null };

type StoreT = {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  categories: string[] | null;
  store_type: string;
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
  ownerId,
  managerIds,
}: {
  users: UserOpt[];
  storeType?: string;
  ownerId?: string | null;
  managerIds?: string[];
}) {
  const chosen = new Set(managerIds ?? []);
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
      <label className="space-y-1 block">
        <span className="text-xs font-medium">
          Store owner{" "}
          <span className="font-normal text-neutral-500">— sees revenue &amp; capital</span>
        </span>
        <select name="owner_user_id" defaultValue={ownerId ?? ""} className={`${inputCls} w-full`}>
          <option value="">— none —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="space-y-1">
        <legend className="text-xs font-medium">
          Inventory managers{" "}
          <span className="font-normal text-neutral-500">
            — any number, no revenue visibility; pick all that apply
          </span>
        </legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {users.map((u) => (
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
        The same person can be both owner and manager. Anyone assigned here is
        bound to this store (other stores&apos; data stays private), and can be
        moved/reassigned again from the Users page.
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
  const members = users.filter((u) => u.store_id === store.id);
  const owner = members.find((u) => u.store_role === "owner");
  const managers = members.filter((u) => u.store_role === "manager");
  const typeLabel = STORE_TYPES.find(([v]) => v === store.store_type)?.[1] ?? store.store_type;

  if (editing) {
    return (
      <form
        action={updAction}
        className="w-full space-y-3 border-b border-neutral-200 p-4 dark:border-neutral-800"
      >
        <input type="hidden" name="store_id" value={store.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="name" required defaultValue={store.name} placeholder="Store name *" className={inputCls} />
          <input name="address" defaultValue={store.address ?? ""} placeholder="Address (optional)" className={inputCls} />
        </div>
        <StoreTypeAndManager
          users={users}
          storeType={store.store_type}
          ownerId={owner?.id ?? null}
          managerIds={managers.map((m) => m.id)}
        />
        <CategoryCheckboxes taxonomy={taxonomy} selected={store.categories} />
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
            ? "No users assigned"
            : members
                .map((m) =>
                  m.store_role === "owner" ? `👑 ${m.full_name}` : `👤 ${m.full_name}`
                )
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
}: {
  taxonomy: Cat[];
  users: UserOpt[];
}) {
  const [state, action, pending] = useActionState(createStoreAction, {});
  return (
    <form
      action={action}
      className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-transparent"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" required placeholder="Store name *" className={inputCls} />
        <input name="address" placeholder="Address (optional)" className={inputCls} />
      </div>
      <StoreTypeAndManager users={users} />
      <CategoryCheckboxes taxonomy={taxonomy} selected={null} />
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
