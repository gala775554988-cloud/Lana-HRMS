import type { ReactNode } from "react";
import Link from "next/link";
import { getCurrentEmployee } from "@/lib/employee/data";

const settingsLinks = [
  { href: "/employee/settings/account", label: "الحساب" },
  { href: "/employee/settings/profile-picture", label: "الصورة الشخصية" },
  { href: "/employee/settings/password", label: "كلمة المرور" },
  { href: "/employee/settings/theme", label: "الثيم" },
  { href: "/employee/settings/language", label: "اللغة" },
  { href: "/employee/settings/notifications", label: "الإشعارات" },
];

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const employee = await getCurrentEmployee();

  return (
    <div className="flex gap-8">
      {/* Settings Sidebar */}
      <div className="w-64 hidden md:block">
        <div className="sticky top-20">
          <div className="font-semibold mb-4">الإعدادات</div>
          <nav className="space-y-1 text-sm">
            {settingsLinks.map(link => (
              <Link 
                key={link.href} 
                href={link.href} 
                className="block px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
