import type { Taxonomy, VariantAttributes } from "@/lib/services/taxonomy";

/** Collect `attr_<key>` form fields into a typed JSONB payload for the
 *  variant's `attributes` column. Keys are validated against the taxonomy
 *  definitions (defense in depth — the DB trigger is the final authority)
 *  and values are coerced per the definition's input type. */
export function parseVariantAttributes(
  formData: FormData,
  taxonomy: Taxonomy,
  category: string
): VariantAttributes {
  const defs = taxonomy.attributesByCategory[category] ?? [];
  const types = new Map(defs.map((d) => [d.attribute_key, d.input_type]));

  const out: VariantAttributes = {};
  for (const [field, raw] of formData.entries()) {
    if (!field.startsWith("attr_") || typeof raw !== "string") continue;
    const key = field.slice(5);
    const inputType = types.get(key);
    if (!inputType) continue; // not declared for this category — skip

    if (inputType === "boolean") {
      out[key] = raw === "on";
      continue;
    }
    if (raw === "") continue;
    out[key] =
      inputType === "number" && Number.isFinite(Number(raw)) ? Number(raw) : raw;
  }
  return out;
}
