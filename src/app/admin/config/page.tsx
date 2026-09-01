import { requireAdmin } from "@/lib/auth";
import { getTaxonomy } from "@/lib/services/taxonomy";
import { getSettings } from "@/lib/settings";
import ConfigTabs from "./config-tabs";
import TaxonomyManager from "./taxonomy-manager";
import SystemSettings from "./system-settings";

export default async function AdminConfigPage() {
  await requireAdmin();
  const [taxonomy, s] = await Promise.all([getTaxonomy(), getSettings()]);

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Configuration</h1>
        <p className="text-sm text-neutral-500 dark:text-slate-400">
          Platform-wide settings for your business — branding, currency, and
          the product taxonomy that drives every form.
        </p>
      </header>
      <ConfigTabs
        taxonomy={<TaxonomyManager taxonomy={taxonomy} />}
        system={<SystemSettings s={s} />}
      />
    </div>
  );
}
