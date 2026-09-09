import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HRMS",
    short_name: "HRMS",
    description: siteConfig.description,
    start_url: "/login?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f5f7fb",
    theme_color: "#18365f",
    categories: ["business", "productivity", "utilities"],
    lang: "ar-SA",
    dir: "rtl",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
    shortcuts: [
      {
        name: "لوحة الموظف",
        short_name: "الموظف",
        description: "فتح لوحة الموظف مباشرة",
        url: "/employee/dashboard",
        icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }]
      },
      {
        name: "تسجيل الدخول",
        short_name: "دخول",
        description: "تسجيل الدخول إلى نظام HRMS",
        url: "/login",
        icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }]
      }
    ]
  };
}
