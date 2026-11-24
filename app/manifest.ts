import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MADAR HR",
    short_name: "MADAR HR",
    description: siteConfig.description,
    id: "/",
    start_url: "/login?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f3f3eb",
    theme_color: "#132b28",
    categories: ["business", "productivity", "utilities"],
    lang: "ar-SA",
    dir: "rtl",
    icons: [{ src: "/brand/madar-hr-v2.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
    shortcuts: [
      {
        name: "لوحة الموظف",
        short_name: "الموظف",
        description: "فتح لوحة الموظف مباشرة",
        url: "/employee/dashboard",
        icons: [{ src: "/brand/madar-hr-v2.svg", sizes: "any", type: "image/svg+xml" }]
      },
      {
        name: "تسجيل الدخول",
        short_name: "دخول",
        description: "تسجيل الدخول إلى نظام مدار HR",
        url: "/login",
        icons: [{ src: "/brand/madar-hr-v2.svg", sizes: "any", type: "image/svg+xml" }]
      }
    ]
  };
}
