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
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col gap-6 border-r border-white/5 bg-[#0f172a]/80 px-4 py-6 backdrop-blur-xl md:flex">
        <div className="flex items-center gap-2 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#a855f7] to-[#06b6d4] font-black text-white">
            P
          </span>
          <span className="text-lg font-bold tracking-tight text-white">
            Perfume IMS
          </span>
        </div>
        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-medium transition-colors ${
                  active ? "text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#a855f7]/25 to-[#06b6d4]/20 ring-1 ring-[#a855f7]/40"
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3 px-2">
          <button
            onClick={toggleTheme}
            className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-white/10 px-4 text-sm text-slate-300 hover:bg-white/5"
          >
            Theme <span>{dark ? "☀️" : "🌙"}</span>
          </button>
          <p className="truncate text-xs text-slate-500">{email}</p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/5 bg-[#0f172a]/80 px-4 py-3 backdrop-blur-xl md:hidden">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#a855f7] to-[#06b6d4] text-xs font-bold text-white">
          {initials}
        </span>
        <span className="flex-1 font-bold text-white">Perfume IMS</span>
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="flex h-11 w-11 items-center justify-center rounded-full text-lg hover:bg-white/5"
        >
          {dark ? "☀️" : "🌙"}
        </button>
      </header>

      {/* Content */}
      <div className="md:pl-60">{children}</div>

      {/* Mobile bottom nav */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-[#0f172a]/90 backdrop-blur-xl md:hidden">
        <nav className="flex overflow-x-auto">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex min-h-14 min-w-16 flex-1 flex-col items-center justify-center px-2 py-2 text-[10px] font-medium ${
                  active ? "text-white" : "text-slate-400"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill-mobile"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="absolute inset-x-1 top-1 bottom-1 rounded-2xl bg-gradient-to-r from-[#a855f7]/25 to-[#06b6d4]/20 ring-1 ring-[#a855f7]/40"
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
