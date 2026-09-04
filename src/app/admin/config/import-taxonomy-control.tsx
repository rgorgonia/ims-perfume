"use client";

import { useActionState } from "react";
import { importTaxonomyAction, type ImportResult } from "./actions";

/** "Import attributes from another store" — copies that store's taxonomy
 *  into the currently selected store as its own (source stays untouched). */
export default function ImportTaxonomyControl({
  storeId,
  candidates,
}: {
  storeId: string;
  candidates: { id: string; name: string }[];
}) {
  const [res, formAction, pending] = useActionState(importTaxonomyAction, {} as ImportResult);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="store_id" value={storeId} />
      <label
        htmlFor="import-source"
        className="text-xs font-medium text-neutral-600 dark:text-neutral-400"
      >
        Import attributes from
      </label>
      <select
        id="import-source"
        name="source_store_id"
        required
        defaultValue=""
        className="rounded-[10px] border border-black/10 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-transparent"
      >
        <option value="" disabled>
          Choose a store…
        </option>
        {candidates.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold hover:bg-black/[0.04] disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-white/10"
      >
        {pending ? "Importing…" : "Import"}
      </button>
      {res.error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {res.error}
        </span>
      )}
      {res.success && (
        <span role="status" className="text-xs text-emerald-600 dark:text-emerald-400">
          {res.success}
        </span>
      )}
    </form>
  );
}
