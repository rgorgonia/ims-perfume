"use client";

import { useState } from "react";

/** Chip-based editor for the global product category list.
 *  Submits as a hidden comma-separated input alongside the settings form. */
export default function CategoriesEditor({
  name,
  initial,
}: {
  name: string;
  initial: string[];
}) {
  const [cats, setCats] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim();
    if (!value) return;
    // Case-insensitive duplicate check
    if (cats.some((c) => c.toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }
    setCats([...cats, value]);
    setDraft("");
  }

  function remove(cat: string) {
    setCats(cats.filter((c) => c !== cat));
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={cats.join(", ")} />
      <div className="flex flex-wrap gap-2">
        {cats.map((c) => (
          <span
            key={c}
            className="flex items-center gap-1 rounded-[8px] border border-black/10 bg-black/[0.04] px-2.5 py-1 text-xs font-medium dark:border-white/10 dark:bg-white/10"
          >
            {c}
            <button
              type="button"
              onClick={() => remove(c)}
              aria-label={`Remove ${c}`}
              className="text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
            >
              ✕
            </button>
          </span>
        ))}
        {cats.length === 0 && (
          <span className="text-xs text-neutral-500">
            No categories — add one below.
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="New category name…"
          className="w-full rounded-[10px] border border-black/10 bg-white/60 px-3 py-2 text-sm outline-none focus:border-neutral-500/60 focus:ring-2 focus:ring-neutral-400/40 dark:border-white/10 dark:bg-white/5"
        />
        <button
          type="button"
          onClick={add}
          className="shrink-0 rounded-[10px] border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/[0.04] dark:border-white/10 dark:hover:bg-white/10"
        >
          Add
        </button>
      </div>
    </div>
  );
}