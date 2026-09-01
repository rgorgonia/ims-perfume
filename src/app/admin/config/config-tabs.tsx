"use client";

import { useState } from "react";
import { Tags, Building2 } from "lucide-react";

type TabKey = "taxonomy" | "system";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "taxonomy", label: "Taxonomy & attributes", icon: Tags },
  { key: "system", label: "System", icon: Building2 },
];

export default function ConfigTabs({
  taxonomy,
  system,
}: {
  taxonomy: React.ReactNode;
  system: React.ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("taxonomy");

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Configuration sections"
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
      <div role="tabpanel">{tab === "taxonomy" ? taxonomy : system}</div>
    </div>
  );
}
