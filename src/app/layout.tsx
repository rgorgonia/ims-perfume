import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getSession } from "@/lib/auth";
import ThemeToggle from "@/components/theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Perfume IMS",
  description: "Multi-store inventory management system for your perfume business.",
};

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/sales", label: "Sales" },
  { href: "/products", label: "Products" },
  { href: "/stores", label: "Stores" },
  { href: "/users", label: "Users" },
];

const themeInitScript = `
(function () {
  try {
    var t = localStorage.getItem("theme");
    if (t === "dark") document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {session && (
          <nav className="border-b border-neutral-200 dark:border-neutral-800">
            <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 text-sm">
              <span className="font-bold">Perfume IMS</span>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-neutral-600 transition-colors hover:text-foreground dark:text-neutral-400"
                >
                  {link.label}
                </Link>
              ))}
              <span className="ml-auto text-neutral-500">
                {session.user.email}
              </span>
              <ThemeToggle />
            </div>
          </nav>
        )}
        {children}
      </body>
    </html>
  );
}

