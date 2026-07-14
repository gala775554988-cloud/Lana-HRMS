"use client";

import { useThemeStore } from "@/store/theme";
import { 
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, 
  Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis 
} from "recharts";

const palette = ["#00A896", "#028090", "#22C55E", "#F59E0B", "#EF4444", "#06B6D4"];

function cardClass(extra = "") {
  return `rounded-3xl border border-slate-200/80 bg-white p-6 shadow-md shadow-slate-200/40 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:shadow-none ${extra}`;
}

type Series = { months: string[]; employeeGrowth: number[]; requests: number[]; payroll: number[] };

export function DashboardCharts({ metrics, series }: { metrics: Record<string, unknown>; series?: Series }) {
  const { mode } = useThemeStore();
  const isDark = mode === "dark";

  const departments = Number(metrics.departments ?? 0);
  const branches = Number(metrics.branches ?? 0);
  const hospitals = Number(metrics.hospitals ?? 0);
  const contracts = Number(metrics.contracts ?? 0);
  const attendance = Number(metrics.attendanceToday ?? 0);
  const leave = Number(metrics.pendingLeave ?? 0);
  const requests = Number(metrics.requestsToday ?? 0);
  const overtime = Number(metrics.overtimePending ?? 0);

  // Real historical data computed server-side (see app/(hrms)/dashboard/page.tsx),
  // not a fabricated growth formula. Falls back to a flat single point only if
  // the series prop is somehow missing (defensive, shouldn't happen).
  const months = series?.months ?? [new Date().toISOString().slice(0, 7)];
  const growth = months.map((month, index) => ({
    month,
    الموظفون: series?.employeeGrowth[index] ?? 0,
    الطلبات: series?.requests[index] ?? 0
  }));

  const operations = [
    { name: "الحضور اليوم", value: attendance },
    { name: "الإجازات", value: leave },
    { name: "الأوفر تايم", value: overtime },
    { name: "طلبات عامة", value: requests }
  ];

  const org = [
    { name: "الإدارات", value: departments },
    { name: "المستشفيات", value: hospitals },
    { name: "الفروع", value: branches },
    { name: "العقود", value: contracts }
  ];

  const payrollData = months.map((month, index) => ({
    month,
    الرواتب: Math.round((series?.payroll[index] ?? 0) / 1000)
  }));

  const gridColor = isDark ? "#1e293b" : "#e2e8f0";
  const textColor = isDark ? "#94a3b8" : "#64748b";

  return (
    <div className="grid gap-5 xl:grid-cols-12">
      {/* Employee Growth Chart */}
      <div className={cardClass("xl:col-span-7 h-[420px] flex flex-col justify-between")}> 
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">نمو الكوادر الوظيفية والطلبات</h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">تتبع مؤشرات القوى العاملة على مدار الأشهر الثمانية الماضية</p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">مباشر Live</span>
        </div>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={growth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="lanaEmployees" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00A896" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#00A896" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} stroke={textColor} fontSize={12} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} stroke={textColor} fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? "#0f172a" : "#ffffff",
                  borderColor: isDark ? "#1e293b" : "#e2e8f0",
                  borderRadius: "1rem",
                  boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                  color: isDark ? "#f8fafc" : "#0f172a",
                  fontSize: "12px",
                  fontWeight: "bold"
                }}
              />
              <Area type="monotone" dataKey="الموظفون" stroke="#00A896" strokeWidth={3} fill="url(#lanaEmployees)" />
              <Line type="monotone" dataKey="الطلبات" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Organization Distribution Pie Chart */}
      <div className={cardClass("xl:col-span-5 h-[420px] flex flex-col justify-between")}> 
        <div className="mb-4">
          <h3 className="text-base font-black text-slate-900 dark:text-slate-100">توزيع الهيكل التنظيمي والمقرات</h3>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">نسبة الإدارات والمستشفيات والفروع والعقود</p>
        </div>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={org}
                dataKey="value"
                nameKey="name"
                innerRadius={68}
                outerRadius={114}
                paddingAngle={5}
                stroke={isDark ? "#0f172a" : "#ffffff"}
                strokeWidth={3}
              >
                {org.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? "#0f172a" : "#ffffff",
                  borderColor: isDark ? "#1e293b" : "#e2e8f0",
                  borderRadius: "1rem",
                  color: isDark ? "#f8fafc" : "#0f172a",
                  fontSize: "12px",
                  fontWeight: "bold"
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mx-1">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Operations Bar Chart */}
      <div className={cardClass("xl:col-span-6 h-[380px] flex flex-col justify-between")}> 
        <div className="mb-4">
          <h3 className="text-base font-black text-slate-900 dark:text-slate-100">الحركات والعمليات اليومية</h3>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">مقارنة بين حضور اليوم، الإجازات، والأوفر تايم</p>
        </div>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={operations} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} stroke={textColor} fontSize={12} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} stroke={textColor} fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? "#0f172a" : "#ffffff",
                  borderColor: isDark ? "#1e293b" : "#e2e8f0",
                  borderRadius: "1rem",
                  color: isDark ? "#f8fafc" : "#0f172a",
                  fontSize: "12px",
                  fontWeight: "bold"
                }}
              />
              <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                {operations.map((entry, index) => (
                  <Cell key={`bar-${index}`} fill={palette[index % palette.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payroll Trend Line Chart */}
      <div className={cardClass("xl:col-span-6 h-[380px] flex flex-col justify-between")}> 
        <div className="mb-4">
          <h3 className="text-base font-black text-slate-900 dark:text-slate-100">تطور مسيرات الرواتب والمستحقات (بالألف ر.س)</h3>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">التدرج المالي لمسيرات الرواتب المدفوعة</p>
        </div>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={payrollData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} stroke={textColor} fontSize={12} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} stroke={textColor} fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? "#0f172a" : "#ffffff",
                  borderColor: isDark ? "#1e293b" : "#e2e8f0",
                  borderRadius: "1rem",
                  color: isDark ? "#f8fafc" : "#0f172a",
                  fontSize: "12px",
                  fontWeight: "bold"
                }}
              />
              <Line type="monotone" dataKey="الرواتب" stroke="#22C55E" strokeWidth={3.5} dot={{ r: 5, fill: "#22C55E" }} activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
