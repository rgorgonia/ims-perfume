import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();

  let tenantName: string | null = null;
  let storeName: string | null = null;
  if (session?.tenant_id) {
    const t = await supabase
      .from("tenants")
      .select("name")
      .eq("id", session.tenant_id)
      .maybeSingle();
    tenantName = (t.data as { name: string } | null)?.name ?? null;
  }
  if (session?.profile?.store_id) {
    const s = await supabase
      .from("stores")
      .select("name")
      .eq("id", session.profile.store_id)
      .maybeSingle();
    storeName = (s.data as { name: string } | null)?.name ?? null;
  }

  const settings = await getSettings(session?.tenant_id ?? null);

  const roleLabel =
    session?.profile?.role === "platform_admin"
      ? "Platform Admin"
      : session?.profile?.role === "tenant_owner"
        ? "Owner"
        : "Store Manager";

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
            isAdmin={session.isPlatformAdmin || session.isTenantOwner}
            isPlatformAdmin={session.isPlatformAdmin}
            roleLabel={roleLabel}
            tenantName={tenantName}
            storeName={storeName}
            businessName={settings.businessName}
            avatarUrl={session.profile?.avatar_url ?? null}
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


