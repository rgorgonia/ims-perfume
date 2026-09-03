"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateProfileAction } from "@/app/actions";

const inputCls =
  "w-full rounded-[10px] border border-black/10 bg-white/60 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500/60 focus:ring-2 focus:ring-neutral-400/40 dark:border-white/10 dark:bg-white/5 dark:text-white";

type Msg = { ok: boolean; text: string } | null;

export default function SettingsForms({
  email,
  fullName,
  role,
  userId,
  avatarUrl,
}: {
  email: string;
  fullName: string;
  role: string;
  userId: string;
  avatarUrl: string | null;
}) {
  const [name, setName] = useState(fullName);
  const [avatar, setAvatar] = useState<string | null>(avatarUrl);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profileMsg, setProfileMsg] = useState<Msg>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg] = useState<Msg>(null);
  const [savingPw, setSavingPw] = useState(false);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setProfileMsg(null);
    if (!file.type.startsWith("image/")) {
      setProfileMsg({ ok: false, text: "Please choose an image file" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileMsg({ ok: false, text: "Image must be under 2 MB" });
      return;
    }
    setUploadingPhoto(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { contentType: file.type, upsert: true });
    if (upErr) {
      setProfileMsg({ ok: false, text: upErr.message });
      setUploadingPhoto(false);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatar(data.publicUrl);
    // Persist immediately so the sidebar picks it up without a separate save.
    const fd = new FormData();
    fd.set("full_name", name);
    fd.set("avatar_url", data.publicUrl);
    const res = await updateProfileAction(fd);
    setProfileMsg(
      res?.error
        ? { ok: false, text: res.error }
        : { ok: true, text: "Profile photo updated" }
    );
    setUploadingPhoto(false);
  }

  async function removePhoto() {
    setProfileMsg(null);
    setAvatar(null);
    const fd = new FormData();
    fd.set("full_name", name);
    fd.set("avatar_url", "");
    const res = await updateProfileAction(fd);
    setProfileMsg(
      res?.error
        ? { ok: false, text: res.error }
        : { ok: true, text: "Profile photo removed" }
    );
  }

  async function handleProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileMsg(null);
    setSavingProfile(true);
    const fd = new FormData();
    fd.set("full_name", name);
    if (avatar) fd.set("avatar_url", avatar);
    const res = await updateProfileAction(fd);
    setProfileMsg(
      res?.error
        ? { ok: false, text: res.error }
        : { ok: true, text: res?.success ?? "Profile updated" }
    );
    setSavingProfile(false);
  }

  async function handlePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword.length < 8) {
      setPwMsg({ ok: false, text: "Password must be at least 8 characters" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ ok: false, text: "Passwords do not match" });
      return;
    }
    setSavingPw(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPwMsg({ ok: false, text: error.message });
    } else {
      setPwMsg({ ok: true, text: "Password changed successfully" });
      setNewPassword("");
      setConfirmPassword("");
    }
    setSavingPw(false);
  }

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-2">
      {/* Account info */}
      <section className="soft min-w-0 rounded-[18px] p-6">
        <h2 className="mb-4 text-[15px] font-semibold">Account</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="shrink-0 text-neutral-500 dark:text-slate-400">Email</dt>
            <dd className="min-w-0 truncate font-medium" title={email}>
              {email}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="shrink-0 text-neutral-500 dark:text-slate-400">Role</dt>
            <dd className="min-w-0 truncate font-medium">
              {role === "platform_admin" ? "Platform Admin" : role === "tenant_owner" ? "Owner" : "Store Manager"}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-neutral-500 dark:text-slate-400">
          Email and role can only be changed by a system admin on the Users page.
        </p>
      </section>
      {/* Profile name + photo */}
      <section className="soft min-w-0 rounded-[18px] p-6">
        <h2 className="mb-4 text-[15px] font-semibold">Profile</h2>
        <div className="mb-4 flex items-center gap-4">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt="Profile photo"
              className="h-16 w-16 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-lg font-semibold text-white dark:bg-white dark:text-neutral-900">
              {(name || email).trim().charAt(0).toUpperCase()}
            </span>
          )}
          <div className="space-y-2">
            <label
              htmlFor="avatar"
              className="inline-block cursor-pointer rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium hover:bg-black/[0.04] dark:border-white/10 dark:hover:bg-white/[0.06]"
            >
              {uploadingPhoto ? "Uploading…" : avatar ? "Change photo" : "Upload photo"}
            </label>
            <input
              id="avatar"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhoto}
              disabled={uploadingPhoto}
            />
            {avatar && (
              <button
                type="button"
                onClick={removePhoto}
                className="block text-xs text-red-600 hover:underline dark:text-red-400"
              >
                Remove photo
              </button>
            )}
            <p className="text-xs text-neutral-500 dark:text-slate-400">
              JPG or PNG, up to 2 MB.
            </p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={handleProfile}>
          <div className="space-y-1">
            <label htmlFor="full_name" className="text-sm font-medium">
              Full name
            </label>
            <input
              id="full_name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </div>
          {profileMsg && (
            <p className={`text-sm ${profileMsg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {profileMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={savingProfile}
            className="btn-neon rounded-full px-5 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {savingProfile ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>

      {/* Change password */}
      <section className="soft min-w-0 rounded-[18px] p-6 lg:col-span-2">
        <h2 className="mb-1 text-[15px] font-semibold">Change password</h2>
        <p className="mb-4 text-xs text-neutral-500 dark:text-slate-400">
          Minimum 8 characters. You will stay signed in on this device after changing it.
        </p>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handlePassword}>
          <div className="space-y-1">
            <label htmlFor="new_password" className="text-sm font-medium">
              New password
            </label>
            <input
              id="new_password"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="confirm_password" className="text-sm font-medium">
              Confirm new password
            </label>
            <input
              id="confirm_password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            {pwMsg && (
              <p className={`mb-3 text-sm ${pwMsg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {pwMsg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={savingPw}
              className="btn-neon rounded-full px-5 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {savingPw ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
