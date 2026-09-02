"use client";

import { useState } from "react";
import { Store, SlidersHorizontal } from "lucide-react";

type TabKey = "stores" | "config";

const TABS: {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "stores", label: "Stores", icon: Store },
  { key: "config", label: "Configuration", icon: SlidersHorizontal },
];

export default function StoreHub({
  initial,
  storesPanel,
  configPanel,
}: {
  initial: TabKey;
  storesPanel: React.ReactNode;
  configPanel: React.ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>(initial);
  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Stores and configuration"
        className="flex flex-wrap gap-1 rounded-full border border-black/[0.08] bg-white/60 p-1 dark:border-white/10 dark:bg-white/5"
      >
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "text-neutral-600 hover:bg-black/[0.05] dark:text-slate-300 dark:hover:bg-white/10"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{tab === "stores" ? storesPanel : configPanel}</div>
    </div>
  );
}