import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { siteConfig } from "@/config/site";
import { getDirection, normalizeLocale } from "@/lib/i18n";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";
import { ThemeProvider } from "@/components/hrms/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { I18nRuntime } from "@/components/i18n/i18n-runtime";
import { LazyLanaAiAssistant } from "@/components/enterprise/lazy-lana-ai-assistant";
import { PWAInstallPrompt } from "@/components/pwa/pwa-install-prompt";
import { PWARegister } from "@/components/pwa/pwa-register";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: siteConfig.name, template: "%s | Lana HRMS" },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  authors: [{ name: "Lana HRMS" }],
  keywords: ["HRMS", "Human Resources", "Payroll", "Attendance", "Recruitment", "Employee Management"],
  openGraph: { title: siteConfig.name, description: siteConfig.description, type: "website", locale: "ar_SA" },
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32", type: "image/x-icon" },
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
    ]
  },
  appleWebApp: {
    capable: true,
    title: "Lana HRMS",
    statusBarStyle: "default"
  },
  formatDetection: {
    telephone: false
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "Lana HRMS"
  }
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, maximumScale: 1,
  themeColor: "#ffffff"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const headerLocale = requestHeaders.get("x-lana-locale");
  const cookieLocale = cookieStore.get("lana-locale")?.value;
  const locale = normalizeLocale(headerLocale ?? cookieLocale);

  return (
    <html lang={locale} dir={getDirection(locale)} className="light" style={{ colorScheme: "light" }} suppressHydrationWarning>
      <body>
        <SessionProvider refetchOnWindowFocus={false} refetchWhenOffline={false}>
          <QueryProvider>
            <ThemeProvider>
              <PWARegister />
              <I18nRuntime initialLocale={locale} />
              {children}
              <LazyLanaAiAssistant />
              <PWAInstallPrompt />
            </ThemeProvider>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
