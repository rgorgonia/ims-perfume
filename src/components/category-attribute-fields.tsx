"use client";

import { useState } from "react";
import type { Taxonomy, CategoryAttributeDefinition } from "@/lib/services/taxonomy";

const inputCls =
  "rounded-[10px] border border-black/10 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-transparent";

/** Render the input for one attribute definition. Field name convention:
 *  `attr_<key>` — the Server Action parses these into the variant's JSONB. */
function AttributeInput({ def }: { def: CategoryAttributeDefinition }) {
  const name = `attr_${def.attribute_key}`;

  if (def.input_type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name={name} className="h-4 w-4" />
        {def.label}
        {def.required && <span className="text-red-500">*</span>}
      </label>
    );
  }

  if (def.input_type === "select") {
    return (
      <select
        name={name}
        required={def.required}
        defaultValue=""
        aria-label={def.label}
        className={inputCls}
      >
        <option value="" disabled>
          {def.label}
          {def.required ? " *" : ""}
        </option>
        {(def.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  const type =
    def.input_type === "number"
      ? "number"
      : def.input_type === "date"
        ? "date"
        : "text";

  return (
    <input
      name={name}
      type={type}
      step={type === "number" ? "any" : undefined}
      required={def.required}
      placeholder={def.required ? `${def.label} *` : def.label}
      aria-label={def.label}
      className={inputCls}
    />
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
  const { categories, attributesByCategory } = taxonomy;
  const [category, setCategory] = useState(
    initialCategory && categories.some((c) => c.slug === initialCategory)
      ? initialCategory
      : (categories[0]?.slug ?? "")
  );
  const defs = attributesByCategory[category] ?? [];

  return (
    <>
      <select
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
      {defs.map((d) => (
        <AttributeInput key={d.id} def={d} />
      ))}
    </>
  );
}
