import Link from "next/link";
import { auth } from "@/auth";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    const roles = (session.user.roles as string[]) || [];
    
    // Check if user has admin privileges
    const isAdmin = roles.some((role: string) => 
      ["SUPER_ADMIN", "HR_MANAGER", "PAYROLL_MANAGER", "RECRUITER", "MANAGER"].includes(role)
    );

    if (isAdmin) {
      redirect("/dashboard");
    } else {
      redirect("/employee/dashboard");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50/90 px-6">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex justify-center">
          <BrandLogo
            href={null}
            size="hero"
            className="flex-col text-center"
            textClassName="text-center"
            logoClassName="border-slate-300 shadow-2xl shadow-indigo-950/20 ring-4 ring-white/80"
            imageClassName="p-2"
            subtitleClassName="mt-2 text-slate-600"
          />
        </div>

        <div className="space-y-4">
          {/* Employee Login */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="mb-4">
              <div className="text-2xl mb-1">👤</div>
              <h3 className="font-semibold">تسجيل دخول الموظف</h3>
              <p className="text-sm text-slate-500 mt-1">استخدم رقم الهوية الوطنية</p>
            </div>
            <Button asChild className="w-full" size="lg">
              <Link href="/login">دخول الموظف</Link>
            </Button>
          </div>

          {/* Admin Login - "بطل خارق" */}
          <div className="rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 p-6 shadow-sm">
            <div className="mb-4">
              <div className="text-2xl mb-1">👑</div>
              <h3 className="font-semibold text-purple-700">دخول المسؤول (بطل خارق)</h3>
              <p className="text-sm text-purple-600 mt-1">لوحة التحكم الكاملة + صلاحيات عالية</p>
            </div>
            <Button asChild variant="default" className="w-full bg-purple-600 hover:bg-purple-700" size="lg">
              <Link href="/login">دخول المسؤول</Link>
            </Button>
            <p className="mt-2 text-[10px] text-purple-500">البريد الإلكتروني + كلمة المرور</p>
          </div>
        </div>
      </div>
    </main>
  );
}
