import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AdminDashboard() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const roles = (session.user.roles as string[]) || [];
  const isAdmin = roles.some((role: string) =>
    ["SUPER_ADMIN", "HR_MANAGER", "PAYROLL_MANAGER", "RECRUITER", "MANAGER"].includes(role)
  );

  if (!isAdmin) {
    redirect("/employee/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Powerful Admin Header */}
      <div className="border-b border-slate-800 bg-slate-900">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <span className="text-xl">👑</span>
              </div>
              <div>
                <div className="font-bold text-xl">Lana HRMS</div>
                <div className="text-[10px] text-purple-400 -mt-1">Admin Console</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="px-4 py-1.5 bg-slate-800 rounded-full text-sm flex items-center gap-2">
              <div className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span>Super Admin</span>
            </div>
            <a href="/logout" className="text-sm px-4 py-2 hover:bg-slate-800 rounded-xl transition">تسجيل الخروج</a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-10">
          <h1 className="text-4xl font-bold">لوحة تحكم المسؤولين</h1>
          <p className="text-slate-400 mt-2">مرحباً بك في لوحة التحكم المتقدمة</p>
        </div>

        {/* Powerful Admin Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <a href="/(hrms)/employees" className="group block p-6 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-3xl transition">
            <div className="text-4xl mb-4">👥</div>
            <div className="font-semibold text-xl mb-1">إدارة الموظفين</div>
            <div className="text-sm text-slate-400">عرض وتعديل جميع الموظفين</div>
          </a>

          <a href="/(hrms)/payroll-runs" className="group block p-6 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-3xl transition">
            <div className="text-4xl mb-4">💰</div>
            <div className="font-semibold text-xl mb-1">الرواتب والمدفوعات</div>
            <div className="text-sm text-slate-400">إدارة كشوف الرواتب والحسابات</div>
          </a>

          <a href="/(hrms)/reports" className="group block p-6 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-3xl transition">
            <div className="text-4xl mb-4">📊</div>
            <div className="font-semibold text-xl mb-1">التقارير والتحليلات</div>
            <div className="text-sm text-slate-400">تقارير متقدمة وإحصائيات</div>
          </a>

          <a href="/(hrms)/settings" className="group block p-6 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-3xl transition">
            <div className="text-4xl mb-4">⚙️</div>
            <div className="font-semibold text-xl mb-1">إعدادات النظام</div>
            <div className="text-sm text-slate-400">إدارة الصلاحيات والإعدادات</div>
          </a>
        </div>

        <div className="mt-10 text-center text-xs text-slate-500">
          لوحة التحكم المتقدمة • صلاحيات كاملة • تصميم احترافي
        </div>
      </div>
    </div>
  );
}
