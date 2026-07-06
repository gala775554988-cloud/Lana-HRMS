import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { siteConfig } from "@/config/site";
import { getDirection, normalizeLocale } from "@/lib/i18n";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/hrms/theme-provider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: siteConfig.name, template: "%s | Lana HRMS" },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  authors: [{ name: "Lana HRMS" }],
  keywords: ["HRMS", "Human Resources", "Payroll", "Attendance", "Recruitment", "Employee Management"],
  openGraph: { title: siteConfig.name, description: siteConfig.description, type: "website", locale: "en_US" },
  robots: { index: false, follow: false }
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
            {children}
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
