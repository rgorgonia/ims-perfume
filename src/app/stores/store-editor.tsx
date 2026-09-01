"use client";

import { useActionState, useState } from "react";
import {
  createStoreAction,
  updateStoreAction,
  deleteStoreAction,
  type StoreActionState,
} from "./actions";

type Cat = { slug: string; label: string };

type StoreT = {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  categories: string[] | null;
};

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
export function StoreRow({ store, taxonomy }: { store: StoreT; taxonomy: Cat[] }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [upd, updAction, updPending] = useActionState(updateStoreAction, {});
  const [del, delAction, delPending] = useActionState(deleteStoreAction, {});

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
          {store.address ? `${store.address} · ` : ""}
          {!store.categories || store.categories.length === 0
            ? "All categories"
            : store.categories.join(", ")}
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
export function CreateStoreForm({ taxonomy }: { taxonomy: Cat[] }) {
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
