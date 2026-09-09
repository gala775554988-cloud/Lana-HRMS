import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "@/lib/error-interceptor";
import { cookies, headers } from "next/headers";
import { siteConfig } from "@/config/site";
import { getDirection, normalizeLocale } from "@/lib/i18n";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";
import { ThemeProvider } from "@/components/hrms/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { I18nRuntime } from "@/components/i18n/i18n-runtime";
import { PWAInstallPrompt } from "@/components/pwa/pwa-install-prompt";
import { PWARegister } from "@/components/pwa/pwa-register";

export const dynamic = "force-dynamic";

const interfaceFont = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ibm-plex-arabic"
});

function getSafeMetadataBase() {
  const url = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  try {
    return new URL(url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`);
  } catch {
    return new URL("https://lanahr.vercel.app");
  }
}

export const metadata: Metadata = {
  metadataBase: getSafeMetadataBase(),
  title: { default: siteConfig.name, template: "%s | HRMS" },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  authors: [{ name: "HRMS" }],
  keywords: ["HRMS", "Human Resources", "Payroll", "Attendance", "Recruitment", "Employee Management"],
  openGraph: { title: siteConfig.name, description: siteConfig.description, type: "website", locale: "ar_SA" },
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon.svg", sizes: "any", type: "image/svg+xml" }]
  },
  appleWebApp: {
    capable: true,
    title: "HRMS",
    statusBarStyle: "default"
  },
  formatDetection: {
    telephone: false
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "HRMS"
  }
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, maximumScale: 1,
  themeColor: "#18365f"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers().catch(() => null);
  const cookieStore = await cookies().catch(() => null);
  // Seed the client SessionProvider with the same server session used by the
  // protected layouts. Without this, AppShell can SSR in its loading state
  // but hydrate as authenticated (or vice versa), which changes the shell's
  // DOM tree and triggers React hydration error #418 on /dashboard.
  const session = await auth().catch(() => null);
  const headerLocale = requestHeaders?.get("x-lana-locale");
  const cookieLocale = cookieStore?.get("lana-locale")?.value;
  const locale = normalizeLocale(headerLocale ?? cookieLocale);

  return (
    <html lang={locale} dir={getDirection(locale)} className={`${interfaceFont.variable} light`} style={{ colorScheme: "light" }} suppressHydrationWarning>
      <body>
        <SessionProvider session={session} refetchOnWindowFocus={false} refetchWhenOffline={false}>
          <QueryProvider>
            <ThemeProvider>
              <PWARegister />
              <I18nRuntime initialLocale={locale} />
              {children}
              <PWAInstallPrompt />
            </ThemeProvider>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
