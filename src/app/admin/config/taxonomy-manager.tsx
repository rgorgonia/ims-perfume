"use client";

import { useActionState, useState } from "react";
import {
  addCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  addAttributeDefinitionAction,
  updateAttributeDefinitionAction,
  deleteAttributeDefinitionAction,
} from "@/app/actions/config";
import type {
  Taxonomy,
  Category,
  CategoryAttributeDefinition,
  AttributeInputType,
} from "@/lib/services/taxonomy";

type ActionState = { error?: string; success?: string };
const EMPTY: ActionState = {};

const inputCls =
  "rounded-[10px] border border-black/10 bg-white/60 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500/60 focus:ring-2 focus:ring-neutral-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white";

const btnCls =
  "rounded-full px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50";
const primaryBtn = `btn-neon ${btnCls}`;
const ghostBtn =
  "rounded-full border border-black/[0.08] px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-black/[0.05] dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10";
const dangerBtn =
  "rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950";

const INPUT_TYPES: AttributeInputType[] = [
  "select",
  "text",
  "number",
  "boolean",
  "date",
];

function Msg({ state }: { state: ActionState }) {
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

/* ------------------------------------------------------------------ */
/* Category row — inline edit + two-click delete                       */
/* ------------------------------------------------------------------ */

function CategoryRow({ category }: { category: Category }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [upd, updAction, updPending] = useActionState(updateCategoryAction, EMPTY);
  const [del, delAction, delPending] = useActionState(deleteCategoryAction, EMPTY);

  if (editing) {
    return (
      <form
        action={updAction}
        className="flex w-full flex-wrap items-end gap-2 rounded-2xl border border-black/10 p-3 dark:border-white/10"
      >
        <input type="hidden" name="category_id" value={category.id} />
        <div className="space-y-0.5">
          <label className="text-xs font-medium">Label</label>
          <input name="label" required defaultValue={category.label} className={inputCls} />
        </div>
        <div className="space-y-0.5">
          <label className="text-xs font-medium">Sort order</label>
          <input
            name="sort_order"
            type="number"
            defaultValue={category.sort_order}
            className={`${inputCls} w-20`}
          />
        </div>
        <label className="flex items-center gap-1.5 pb-2 text-xs font-medium">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={category.is_active}
            className="h-4 w-4"
          />
          Active
        </label>
        <button type="submit" disabled={updPending} className={primaryBtn}>
          {updPending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className={ghostBtn}>
          Cancel
        </button>
        <div className="w-full">
          <Msg state={upd} />
        </div>
      </form>
    );
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <span className="rounded-2xl border border-black/[0.08] bg-black/[0.04] px-3 py-1 text-sm dark:border-white/10 dark:bg-white/10">
        {category.label}
        <span className="ml-1.5 font-mono text-xs text-neutral-500">{category.slug}</span>
        {!category.is_active && (
          <span className="ml-1.5 text-xs text-red-500">inactive</span>
        )}
      </span>
      <span className="text-xs text-neutral-400">#{category.sort_order}</span>
      <button type="button" onClick={() => setEditing(true)} className={ghostBtn}>
        Edit
      </button>
      {confirmDelete ? (
        <>
          <span className="text-xs text-red-600 dark:text-red-400">
            Delete category and its attribute definitions?
          </span>
          <form action={delAction} className="contents">
            <input type="hidden" name="category_id" value={category.id} />
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
  );
}

/* ------------------------------------------------------------------ */
/* Main manager                                                        */
/* ------------------------------------------------------------------ */

export default function TaxonomyManager({ taxonomy }: { taxonomy: Taxonomy }) {
  const [addCat, addCatAction, addCatPending] = useActionState(
    addCategoryAction,
    EMPTY
  );
  const [addDef, addDefAction, addDefPending] = useActionState(
    addAttributeDefinitionAction,
    EMPTY
  );

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------ Categories */}
      <section className="soft rounded-[18px] p-6">
        <h2 className="mb-1 text-[15px] font-semibold">Product categories</h2>
        <ol className="mb-4 list-decimal space-y-0.5 pl-5 text-xs text-neutral-500 dark:text-slate-400">
          <li>
            Add a category (e.g. <code>Fragrance</code>) — it appears
            immediately in the product and sales forms.
          </li>
          <li>
            Add attribute definitions for it below (e.g.{" "}
            <code>Concentration</code> with options <code>EDT, EDP</code>) —
            these become the extra fields on every product/variant form.
          </li>
          <li>
            Edit any category to rename it, reorder it, or deactivate it
            (deactivated categories keep their data but disappear from forms).
          </li>
        </ol>

        <div className="mb-4 space-y-2">
          {taxonomy.categories.map((c) => (
            <CategoryRow key={c.id} category={c} />
          ))}
          {taxonomy.categories.length === 0 && (
            <p className="text-sm text-neutral-500">
              No categories yet — add your first one below.
            </p>
          )}
        </div>

        <form action={addCatAction} className="flex flex-wrap items-center gap-3">
          <input
            name="label"
            required
            placeholder="New category label (e.g. Fragrance) *"
            className={inputCls}
          />
          <input
            name="sort_order"
            type="number"
            defaultValue={0}
            aria-label="Sort order"
            title="Sort order — lower numbers appear first"
            className={`${inputCls} w-24`}
          />
          <button
            type="submit"
            disabled={addCatPending}
            className="btn-neon rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {addCatPending ? "Adding…" : "Add category"}
          </button>
          <Msg state={addCat} />
        </form>
      </section>
      {/* ------------------------------------ Attribute definitions */}
      <section className="soft rounded-[18px] p-6">
        <h2 className="mb-1 text-[15px] font-semibold">Attribute definitions</h2>
        <p className="mb-4 text-xs text-neutral-500 dark:text-slate-400">
          Each definition adds a custom field to the product form for that
          category. The value is stored per variant (e.g. one variant can be{" "}
          <code>EDT 50ml</code>, another <code>EDP 100ml</code>). Fields marked{" "}
          <span className="font-medium">Required</span> must be filled in
          before a product can be saved.
        </p>

        <div className="mb-6 space-y-4">
          {taxonomy.categories.map((c) => {
            const defs = taxonomy.attributesByCategory[c.slug] ?? [];
            return (
              <div key={c.id} className="space-y-1">
                <p className="text-sm font-medium">
                  {c.label}{" "}
                  <span className="font-mono text-xs text-neutral-500">
                    ({defs.length} attribute{defs.length === 1 ? "" : "s"})
                  </span>
                </p>
                <div className="space-y-1">
                  {defs.map((d) => (
                    <DefinitionRow key={d.id} def={d} />
                  ))}
                  {defs.length === 0 && (
                    <span className="text-xs text-neutral-500">None yet</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <form
          action={addDefAction}
          className="grid gap-3 rounded-2xl border border-neutral-200 p-4 sm:grid-cols-2 dark:border-neutral-800"
        >
          <div className="space-y-1">
            <label htmlFor="def_category" className="text-sm font-medium">
              Category
            </label>
            <select id="def_category" name="category_id" required className={`${inputCls} w-full`}>
              {taxonomy.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="def_label" className="text-sm font-medium">
              Label
            </label>
            <input
              id="def_label"
              name="label"
              required
              placeholder="e.g. Concentration"
              className={`${inputCls} w-full`}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="def_key" className="text-sm font-medium">
              Attribute key{" "}
              <span className="font-normal text-neutral-500">
                — internal name stored on the variant; lowercase letters,
                numbers, underscores only (e.g. <code>concentration</code>)
              </span>
            </label>
            <input
              id="def_key"
              name="attribute_key"
              required
              pattern="[a-z0-9_]+"
              title="Lowercase letters, numbers and underscores"
              placeholder="concentration"
              className={`${inputCls} w-full font-mono`}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="def_type" className="text-sm font-medium">
              Input type{" "}
              <span className="font-normal text-neutral-500">
                — how the field renders on forms
              </span>
            </label>
            <select id="def_type" name="input_type" required className={`${inputCls} w-full`}>
              <option value="select">select — dropdown, needs options below</option>
              <option value="text">text — free-text field</option>
              <option value="number">number — numeric field</option>
              <option value="boolean">boolean — yes/no checkbox</option>
              <option value="date">date — date picker</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="def_options" className="text-sm font-medium">
              Options{" "}
              <span className="font-normal text-neutral-500">
                — for <code>select</code> only, comma-separated (e.g.{" "}
                <code>EDT, EDP, EXTRAIT</code>)
              </span>
            </label>
            <input
              id="def_options"
              name="options"
              placeholder="EDT, EDP, EXTRAIT, EDC, OIL"
              className={`${inputCls} w-full`}
            />
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="required" className="h-4 w-4" />
              Required
            </label>
            <div className="space-y-1">
              <label htmlFor="def_sort" className="text-sm font-medium">
                Sort order
              </label>
              <input
                id="def_sort"
                name="sort_order"
                type="number"
                defaultValue={0}
                className={inputCls}
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <div className="mb-3">
              <Msg state={addDef} />
            </div>
            <button
              type="submit"
              disabled={addDefPending || taxonomy.categories.length === 0}
              className="btn-neon rounded-full px-5 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {addDefPending ? "Adding…" : "Add attribute definition"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Attribute definition row — inline edit + two-click delete           */
/* ------------------------------------------------------------------ */

function DefinitionRow({ def }: { def: CategoryAttributeDefinition }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [inputType, setInputType] = useState<AttributeInputType>(def.input_type);
  const [upd, updAction, updPending] = useActionState(
    updateAttributeDefinitionAction,
    EMPTY
  );
  const [del, delAction, delPending] = useActionState(
    deleteAttributeDefinitionAction,
    EMPTY
  );

  if (editing) {
    return (
      <form
        action={updAction}
        className="w-full space-y-2 rounded-2xl border border-black/10 p-3 dark:border-white/10"
      >
        <input type="hidden" name="definition_id" value={def.id} />
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-0.5">
            <label className="text-xs font-medium">Label</label>
            <input name="label" required defaultValue={def.label} className={inputCls} />
          </div>
          <div className="space-y-0.5">
            <label className="text-xs font-medium">Input type</label>
            <select
              name="input_type"
              value={inputType}
              onChange={(e) => setInputType(e.target.value as AttributeInputType)}
              className={inputCls}
            >
              {INPUT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {inputType === "select" && (
            <div className="space-y-0.5">
              <label className="text-xs font-medium">Options (comma-separated)</label>
              <input
                name="options"
                defaultValue={(def.options ?? []).join(", ")}
                className={inputCls}
              />
            </div>
          )}
          <div className="space-y-0.5">
            <label className="text-xs font-medium">Sort order</label>
            <input
              name="sort_order"
              type="number"
              defaultValue={def.sort_order}
              className={`${inputCls} w-20`}
            />
          </div>
          <label className="flex items-center gap-1.5 pb-2 text-xs font-medium">
            <input
              type="checkbox"
              name="required"
              defaultChecked={def.required}
              className="h-4 w-4"
            />
            Required
          </label>
          <button type="submit" disabled={updPending} className={primaryBtn}>
            {updPending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className={ghostBtn}>
            Cancel
          </button>
        </div>
        <Msg state={upd} />
      </form>
    );
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <span className="rounded-2xl bg-neutral-100 px-3 py-1 text-xs dark:bg-neutral-900">
        {def.label}
        <span className="font-mono text-neutral-500">
          {" "}· {def.input_type}
          {def.required ? " · required" : ""}
        </span>
      </span>
      <button type="button" onClick={() => setEditing(true)} className={ghostBtn}>
        Edit
      </button>
      {confirmDelete ? (
        <>
          <span className="text-xs text-red-600 dark:text-red-400">
            Remove this definition?
          </span>
          <form action={delAction} className="contents">
            <input type="hidden" name="definition_id" value={def.id} />
            <button type="submit" disabled={delPending} className={dangerBtn}>
              {delPending ? "Deleting…" : "Yes, remove"}
            </button>
          </form>
          <button type="button" onClick={() => setConfirmDelete(false)} className={ghostBtn}>
            Cancel
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirmDelete(true)} className={dangerBtn}>
          ✕
        </button>
      )}
      <div className="w-full">
        <Msg state={del} />
      </div>
    </div>
  );
}
