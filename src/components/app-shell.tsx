"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

type Item = { href: string; label: string; admin?: boolean };

const NAV_ITEMS: Item[] = [
  { href: "/", label: "Dashboard" },
  { href: "/sales", label: "Sales" },
  { href: "/inventory", label: "Inventory" },
  { href: "/products", label: "Products" },
  { href: "/stores", label: "Stores" },
  { href: "/users", label: "Users" },
  { href: "/capital", label: "Capital", admin: true },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export default function AppShell({
  email,
  isAdmin,
  children,
}: {
  email: string;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  const items = NAV_ITEMS.filter((i) => !i.admin || isAdmin);
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar — white, clean SaaS */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col gap-4 border-r border-neutral-200 bg-white px-4 py-6 md:flex dark:border-white/5 dark:bg-[#0f172a]/80 dark:backdrop-blur-xl">
        <div className="flex items-center gap-2 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 font-black text-white">
            P
          </span>
          <span className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
            Perfume IMS
          </span>
        </div>
        <div className="px-2">
          <input
            type="search"
            placeholder="Ask or Search..."
            className="min-h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          />
        </div>
        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-medium transition-colors ${
                  active
                    ? "text-blue-600 dark:text-white"
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="absolute inset-0 rounded-2xl bg-blue-50 ring-1 ring-blue-200 dark:bg-gradient-to-r dark:from-[#a855f7]/25 dark:to-[#06b6d4]/20 dark:ring-[#a855f7]/40"
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3 border-t border-neutral-200 px-2 pt-4 dark:border-white/10">
          <button
            onClick={toggleTheme}
            className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-neutral-200 px-4 text-sm text-neutral-600 hover:bg-neutral-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            Theme <span>{dark ? "☀️" : "🌙"}</span>
          </button>
          <p className="truncate text-xs text-neutral-400 dark:text-slate-500">{email}</p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur-xl md:hidden dark:border-white/5 dark:bg-[#0f172a]/80">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {initials}
        </span>
        <span className="flex-1 font-bold text-neutral-900 dark:text-white">Perfume IMS</span>
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="flex h-11 w-11 items-center justify-center rounded-full text-lg hover:bg-neutral-100 dark:hover:bg-white/5"
        >
          {dark ? "☀️" : "🌙"}
        </button>
      </header>

      {/* Content */}
      <div className="md:pl-64">{children}</div>

      {/* Mobile bottom nav */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur-xl md:hidden dark:border-white/5 dark:bg-[#0f172a]/90">
        <nav className="flex overflow-x-auto">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex min-h-14 min-w-16 flex-1 flex-col items-center justify-center px-2 py-2 text-[10px] font-medium ${
                  active
                    ? "text-blue-600 dark:text-white"
                    : "text-neutral-500 dark:text-slate-400"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill-mobile"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="absolute inset-x-1 top-1 bottom-1 rounded-2xl bg-blue-50 ring-1 ring-blue-200 dark:bg-gradient-to-r dark:from-[#a855f7]/25 dark:to-[#06b6d4]/20 dark:ring-[#a855f7]/40"
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
