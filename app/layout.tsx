import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { siteConfig } from "@/config/site";
import { getDirection, normalizeLocale } from "@/lib/i18n";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/hrms/theme-provider";
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
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" }
  ]
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const headerLocale = requestHeaders.get("x-lana-locale");
  const cookieLocale = cookieStore.get("lana-locale")?.value;
  const locale = normalizeLocale(headerLocale ?? cookieLocale);

  return (
    <html lang={locale} dir={getDirection(locale)} suppressHydrationWarning>
      <body>
        <SessionProvider>
          <ThemeProvider>
            <PWARegister />
            {children}
            <PWAInstallPrompt />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
