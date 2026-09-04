"use client";

import { useId, useState } from "react";
import type { Taxonomy, CategoryAttributeDefinition } from "@/lib/services/taxonomy";

const inputCls =
  "rounded-[10px] border border-black/10 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-transparent";

const labelCls = "text-xs font-medium text-neutral-600 dark:text-neutral-400";

/** Render the input for one attribute definition. Field name convention:
 *  `attr_<key>` — the Server Action parses these into the variant's JSONB.
 *  Every field gets a visible label (plus an accessible htmlFor link) so it's
 *  obvious what each dropdown/input is for. */
function AttributeInput({ def }: { def: CategoryAttributeDefinition }) {
  const name = `attr_${def.attribute_key}`;
  const id = useId();
  const req = def.required ? <span className="text-red-500"> *</span> : null;

  if (def.input_type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name={name} className="h-4 w-4" />
        {def.label}
        {req}
      </label>
    );
  }

  if (def.input_type === "select") {
    return (
      <div className="space-y-1">
        <label htmlFor={id} className={labelCls}>
          {def.label}
          {req}
        </label>
        <select id={id} name={name} required={def.required} defaultValue="" className={inputCls}>
          <option value="" disabled>
            Select {def.label.toLowerCase()}
          </option>
          {(def.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const type =
    def.input_type === "number" ? "number" : def.input_type === "date" ? "date" : "text";

  return (
    <div className="space-y-1">
      <label htmlFor={id} className={labelCls}>
        {def.label}
        {req}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        step={type === "number" ? "any" : undefined}
        required={def.required}
        placeholder={def.label}
        className={inputCls}
      />
    </div>
  );
}

/** Dynamic, taxonomy-driven variant attribute fields (Phase 6).
 *  Replaces the hardcoded category + concentration dropdowns: the category
 *  picker selects from `product_categories` and the attribute inputs are
 *  generated from `category_attribute_definitions` at runtime. */
export default function CategoryAttributeFields({
  taxonomy,
  initialCategory,
}: {
  taxonomy: Taxonomy;
  initialCategory?: string;
}) {
  const categoryId = useId();
  const { categories, attributesByCategory } = taxonomy;
  const [category, setCategory] = useState(
    initialCategory && categories.some((c) => c.slug === initialCategory)
      ? initialCategory
      : (categories[0]?.slug ?? "")
  );
  const defs = attributesByCategory[category] ?? [];

  return (
    <>
      <div className="space-y-1">
        <label htmlFor={categoryId} className={labelCls}>
          Category
        </label>
        <select
          id={categoryId}
          name="category"
          className={inputCls}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      {defs.map((d) => (
        <AttributeInput key={d.id} def={d} />
      ))}
    </>
  );
}
