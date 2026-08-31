"use client";

import { useState } from "react";

const inputCls =
  "rounded-[10px] border border-black/10 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-transparent";

/** Category picker + a secondary dropdown whose options are configured
 *  per category in System settings (e.g. Fragrance → EDT/EDP/…). */
export default function CategoryFields({
  categories,
  options,
}: {
  categories: string[];
  options: Record<string, string[]>;
}) {
  const [category, setCategory] = useState(categories[0] ?? "");
  const opts = options[category] ?? [];

  return (
    <>
      <select
        name="category"
        className={inputCls}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {opts.length > 0 && (
        <select name="concentration" className={inputCls}>
          {opts.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}
    </>
  );
}