import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HRMS Foundation",
  description: "Production-ready foundation for a Human Resource Management System."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
