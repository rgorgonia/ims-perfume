"use client";

import { useActionState } from "react";
import {
  addCategoryAction,
  addAttributeDefinitionAction,
  deleteAttributeDefinitionAction,
} from "@/app/actions/config";
import type { Taxonomy } from "@/lib/services/taxonomy";

type ActionState = { error?: string; success?: string };
const EMPTY: ActionState = {};

const inputCls =
  "rounded-[10px] border border-black/10 bg-white/60 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500/60 focus:ring-2 focus:ring-neutral-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white";

export default function TaxonomyManager({ taxonomy }: { taxonomy: Taxonomy }) {
  const [addCat, addCatAction, addCatPending] = useActionState(
    addCategoryAction,
    EMPTY
  );
  const [addDef, addDefAction, addDefPending] = useActionState(
    addAttributeDefinitionAction,
    EMPTY
  );
  const [delDef, delDefAction, delDefPending] = useActionState(
    deleteAttributeDefinitionAction,
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
        </ol>
        <p className="mb-4 text-xs text-neutral-500 dark:text-slate-400">
          Categories currently defined — the label is shown to users, the slug
          is the internal identifier:
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {taxonomy.categories.map((c) => (
            <span
              key={c.id}
              className="rounded-2xl border border-black/[0.08] bg-black/[0.04] px-3 py-1 text-sm dark:border-white/10 dark:bg-white/10"
            >
              {c.label}
              <span className="ml-1.5 font-mono text-xs text-neutral-500">
                {c.slug}
              </span>
            </span>
          ))}
          {taxonomy.categories.length === 0 && (
            <span className="text-sm text-neutral-500">No categories yet.</span>
          )}
        </div>
        <form action={addCatAction} className="flex flex-wrap gap-3">
          <input
            name="label"
            required
            placeholder="New category label *"
            className={inputCls}
          />
          <button
            type="submit"
            disabled={addCatPending}
            className="btn-neon rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {addCatPending ? "Adding…" : "Add category"}
          </button>
          {(addCat.error || addCat.success) && (
            <p
              className={`self-center text-sm ${
                addCat.error
                  ? "text-red-600 dark:text-red-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {addCat.error ?? addCat.success}
            </p>
          )}
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
              <div key={c.id}>
                <p className="mb-1 text-sm font-medium">
                  {c.label}{" "}
                  <span className="font-mono text-xs text-neutral-500">
                    ({defs.length} attribute{defs.length === 1 ? "" : "s"})
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {defs.map((d) => (
                    <form key={d.id} action={delDefAction} className="contents">
                      <input type="hidden" name="definition_id" value={d.id} />
                      <button
                        type="submit"
                        disabled={delDefPending}
                        title="Remove definition"
                        className="rounded-2xl bg-neutral-100 px-3 py-1 text-xs hover:bg-red-100 disabled:opacity-50 dark:bg-neutral-900 dark:hover:bg-red-950"
                      >
                        {d.label}
                        <span className="font-mono">
                          {" "}· {d.input_type}
                          {d.required ? " · required" : ""}
                        </span>{" "}
                        ✕
                      </button>
                    </form>
                  ))}
                  {defs.length === 0 && (
                    <span className="text-xs text-neutral-500">None</span>
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
            {(addDef.error || addDef.success || delDef.error) && (
              <p
                className={`mb-3 text-sm ${
                  addDef.error || delDef.error
                    ? "text-red-600 dark:text-red-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {addDef.error ?? delDef.error ?? addDef.success}
              </p>
            )}
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
