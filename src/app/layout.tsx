import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/ui/Toast";
import { SiteConfigProvider } from "@/components/layout/SiteConfigProvider";
import { AutoCityProvider } from "@/components/layout/AutoCityProvider";
import { PageTracker } from "@/components/PageTracker";
import { Heartbeat } from "@/components/Heartbeat";
import { getSiteConfig, getSeoConfig, getNavMenus } from "@/lib/config";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
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
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${notoSansSC.variable} antialiased`}>
        <AuthProvider>
          <ToastProvider>
            <SiteConfigProvider siteName={cfg.site_name} siteLogo={cfg.site_logo || ''} nav={nav}>
              <AutoCityProvider>
                <PageTracker />
                <Heartbeat />
                {children}
              </AutoCityProvider>
            </SiteConfigProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}