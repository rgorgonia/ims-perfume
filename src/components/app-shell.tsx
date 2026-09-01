"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Package,
  Store,
  Users,
  Wallet,
  Settings,
  SlidersHorizontal,
  MoreHorizontal,
  X,
  LogOut,
} from "lucide-react";
import { signOutAction } from "@/app/actions";

type Item = {
  href: string;
  label: string;
  admin?: boolean;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_ITEMS: Item[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/products", label: "Products", icon: Package },
  { href: "/stores", label: "Stores", icon: Store },
  { href: "/users", label: "Users", icon: Users },
  { href: "/capital", label: "Capital", admin: true, icon: Wallet },
  { href: "/admin/config", label: "Configuration", admin: true, icon: SlidersHorizontal },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Mobile bottom bar shows the 4 most-used tabs; the rest live in the "More" sheet.
const MOBILE_PRIMARY = NAV_ITEMS.slice(0, 4);

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export default function AppShell({
  email,
  isAdmin,
  businessName,
  children,
}: {
  email: string;
  isAdmin: boolean;
  businessName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [dark, setDark] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  // Close the More sheet whenever the route changes
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("ims-theme.v2", next ? "dark" : "light");
  }

  const items = NAV_ITEMS.filter((i) => !i.admin || isAdmin);
  const moreItems = items.filter((i) => !MOBILE_PRIMARY.some((m) => m.href === i.href));
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar — floating glass pane (spatial, both themes) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col gap-4 border-r border-black/[0.08] bg-white/70 px-4 py-6 backdrop-blur-2xl backdrop-saturate-150 md:flex md:inset-y-4 md:left-4 md:rounded-[28px] md:border md:border-white/60 md:shadow-[0_8px_32px_rgba(30,50,40,0.1)] md:dark:inset-y-4 md:dark:left-4 md:dark:rounded-[28px] md:dark:border md:dark:border-white/15 md:dark:bg-white/5 md:dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-2.5 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-neutral-900 font-semibold text-white dark:bg-white dark:text-neutral-900">
            {(businessName || "I").trim().charAt(0).toUpperCase()}
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-neutral-900 dark:text-white">
            {businessName}
          </span>
        </div>
        <div className="px-2">
          <input
            type="search"
            placeholder="Ask or Search..."
            className="min-h-9 w-full rounded-lg border border-black/[0.08] bg-black/[0.04] px-3 text-[13px] text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-500/60 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200"
          />
        </div>
        <nav className="flex flex-col gap-0.5">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors ${
                  active
                    ? "text-neutral-900 dark:text-white"
                    : "text-neutral-600 hover:bg-black/[0.04] hover:text-neutral-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={{ type: "spring", stiffness: 700, damping: 42 }}
                    className="absolute inset-0 rounded-lg bg-black/[0.06] ring-1 ring-black/[0.12] dark:bg-white/10 dark:ring-white/15"
                  />
                )}
                <Icon className="relative z-10 h-4 w-4" />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2 border-t border-black/[0.08] px-2 pt-4 dark:border-white/10">
          <button
            onClick={toggleTheme}
            className="flex min-h-9 w-full items-center justify-between rounded-lg border border-black/[0.08] px-3 text-[13px] text-neutral-600 hover:bg-black/[0.04] dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
          >
            Appearance <span>{dark ? "☀️" : "🌙"}</span>
          </button>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-[13px] text-neutral-600 hover:bg-black/[0.04] hover:text-neutral-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </form>
          <p className="truncate text-[11px] text-neutral-400 dark:text-slate-500">{email}</p>
        </div>
      </aside>

      {/* Mobile top bar — frosted */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-black/[0.08] bg-white/70 px-4 py-3 backdrop-blur-2xl backdrop-saturate-150 md:hidden dark:border-white/10 dark:bg-[#1c1c1e]/70">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900">
          {initials}
        </span>
        <span className="flex-1 text-[17px] font-semibold tracking-tight text-neutral-900 dark:text-white">{businessName}</span>
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="flex h-11 w-11 items-center justify-center rounded-full text-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
        >
          {dark ? "☀️" : "🌙"}
        </button>
        <form action={signOutAction}>
          <button
            type="submit"
            aria-label="Sign out"
            className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-600 hover:bg-black/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.06]"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </form>
      </header>

      {/* Content */}
      <div className="pb-24 md:pb-0 md:pl-[18rem]">{children}</div>

      {/* Mobile bottom nav — icon tabs + More sheet */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.08] bg-white/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl backdrop-saturate-150 md:hidden dark:border-white/10 dark:bg-[#1c1c1e]/70">
        <nav className="flex items-stretch">
          {MOBILE_PRIMARY.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium ${
                  active
                    ? "text-neutral-900 dark:text-white"
                    : "text-neutral-500 dark:text-slate-400"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill-mobile"
                    transition={{ type: "spring", stiffness: 700, damping: 42 }}
                    className="absolute inset-x-2 top-1 bottom-1 rounded-xl bg-black/[0.06] dark:bg-white/10"
                  />
                )}
                <Icon className="relative z-10 h-5 w-5" />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            aria-label="More"
            className="relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium text-neutral-500 dark:text-slate-400"
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        </nav>
      </div>

      {/* Mobile More sheet */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setMoreOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="absolute inset-x-0 bottom-0 rounded-t-[28px] border-t border-white/20 bg-white/85 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] backdrop-blur-2xl dark:border-white/10 dark:bg-[#1c1c1e]/90"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[15px] font-semibold text-neutral-900 dark:text-white">More</span>
                <button
                  onClick={() => setMoreOpen(false)}
                  aria-label="Close"
                  className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/[0.05] dark:hover:bg-white/10"
                >
                  <X className="h-5 w-5 text-neutral-500 dark:text-slate-400" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {moreItems.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 text-sm font-medium ${
                        active
                          ? "border-black/20 bg-black/[0.06] text-neutral-900 dark:border-white/20 dark:bg-white/10 dark:text-white"
                          : "border-black/[0.08] text-neutral-700 dark:border-white/10 dark:text-slate-300"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
                <button
                  onClick={toggleTheme}
                  className="flex min-h-14 items-center gap-3 rounded-2xl border border-black/[0.08] px-4 text-sm font-medium text-neutral-700 dark:border-white/10 dark:text-slate-300"
                >
                  {dark ? "☀️" : "🌙"} {dark ? "Light" : "Dark"}
                </button>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-black/[0.08] px-4 text-sm font-medium text-red-600 dark:border-white/10 dark:text-red-400"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
