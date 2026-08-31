import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import AppShell from "@/components/app-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { businessName } = await getSettings();
  return {
    title: `${businessName} — IMS`,
    description: `Multi-store inventory management system for ${businessName}.`,
  };
}

// visionOS dark spatial theme is the default; "light" is opt-in via the toggle.
// Key is versioned ("theme.v2") so new design defaults apply over old saved prefs.
const themeInitScript = `
(function () {
  try {
    if (localStorage.getItem("ims-theme.v2") === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {
    document.documentElement.classList.add("dark");
  }
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const settings = await getSettings();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {session ? (
          <AppShell
            email={session.user.email}
            isAdmin={session.profile?.role === "system_admin"}
            businessName={settings.businessName}
          >
            {children}
          </AppShell>
        ) : (
          children
        )}
      </body>
    </html>
  );
}


