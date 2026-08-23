import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/ui/Toast";
import { SiteConfigProvider } from "@/components/layout/SiteConfigProvider";
import { AutoCityProvider } from "@/components/layout/AutoCityProvider";
import { PageTracker } from "@/components/PageTracker";
import { getSiteConfig, getSeoConfig, getNavMenus } from "@/lib/config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const cfg = await getSiteConfig();
  const seo = await getSeoConfig().catch(() => null);
  const siteName = cfg.site_name;
  return {
    title: siteName,
    description: seo?.description ?? siteName,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cfg = await getSiteConfig();
  const nav = (await getNavMenus()).map((n) => ({ id: n.id, label: n.label, href: n.href, sort: n.sort }));
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <ToastProvider>
            <SiteConfigProvider siteName={cfg.site_name} siteLogo={cfg.site_logo || ''} nav={nav}>
              <AutoCityProvider>
                <PageTracker />
                {children}
              </AutoCityProvider>
            </SiteConfigProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}