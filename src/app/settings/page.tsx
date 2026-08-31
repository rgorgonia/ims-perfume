import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import SettingsForms from "./settings-forms";
import SystemSettings from "./system-settings";

export default async function SettingsPage() {
  const { user, profile } = await requireUser();
  const isAdmin = profile?.role === "system_admin";
  const s = await getSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-neutral-500 dark:text-slate-400">
          Manage your account and preferences
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SettingsForms
          email={user.email}
          fullName={profile?.full_name ?? ""}
          role={profile?.role ?? "store_manager"}
        />
        {isAdmin && <SystemSettings s={s} />}
      </div>
    </div>
  );
}
