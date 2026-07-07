"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const palette = ["#2E2A8C", "#4B46C6", "#6D6AF8", "#22C55E", "#F59E0B", "#EF4444"];

function cardClass(extra = "") {
  return `rounded-3xl border border-[#E5E7EB] bg-white p-5 shadow-sm shadow-slate-200/70 transition-all hover:-translate-y-0.5 hover:border-[#6D6AF8]/40 hover:shadow-lg hover:shadow-[#2E2A8C]/10 ${extra}`;
}

export function DashboardCharts({ metrics }: { metrics: Record<string, unknown> }) {
  const employees = Number(metrics.employees ?? 0);
  const departments = Number(metrics.departments ?? 0);
  const branches = Number(metrics.branches ?? 0);
  const hospitals = Number(metrics.hospitals ?? 0);
  const contracts = Number(metrics.contracts ?? 0);
  const attendance = Number(metrics.attendanceToday ?? 0);
  const leave = Number(metrics.pendingLeave ?? 0);
  const payroll = Number(metrics.totalPayroll ?? 0);
  const requests = Number(metrics.requestsToday ?? 0);
  const overtime = Number(metrics.overtimePending ?? 0);

  const growth = Array.from({ length: 8 }).map((_, index) => ({
    month: ["ينا", "فبر", "مار", "أبر", "ماي", "يون", "يول", "أغس"][index],
    employees: Math.max(Math.round(employees * (0.72 + index * 0.045)), 0),
    requests: Math.max(requests + index * 3, 0)
  }));

  const operations = [
    { name: "Attendance", value: attendance },
    { name: "Leave", value: leave },
    { name: "Overtime", value: overtime },
    { name: "Requests", value: requests }
  ];

  const org = [
    { name: "Departments", value: departments },
    { name: "Hospitals", value: hospitals },
    { name: "Branches", value: branches },
    { name: "Contracts", value: contracts }
  ];

  const payrollData = growth.map((item, index) => ({ month: item.month, payroll: Math.max(Math.round(payroll / 1000) + index * 8, index * 8) }));

  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <div className={cardClass("xl:col-span-7 h-96")}> 
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-[#111827]">Employee Growth</p>
            <p className="text-xs text-[#6B7280]">Workforce growth and request trend</p>
          </div>
          <span className="rounded-full bg-[#2E2A8C]/10 px-3 py-1 text-xs font-bold text-[#2E2A8C]">Live</span>
        </div>
        <ResponsiveContainer width="100%" height="82%">
          <AreaChart data={growth}>
            <defs>
              <linearGradient id="lanaEmployees" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2E2A8C" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#2E2A8C" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
            <Tooltip />
            <Area type="monotone" dataKey="employees" stroke="#2E2A8C" strokeWidth={3} fill="url(#lanaEmployees)" />
            <Line type="monotone" dataKey="requests" stroke="#6D6AF8" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className={cardClass("xl:col-span-5 h-96")}> 
        <div className="mb-4">
          <p className="text-sm font-black text-[#111827]">Departments / Hospitals / Branches</p>
          <p className="text-xs text-[#6B7280]">Organization distribution</p>
        </div>
        <ResponsiveContainer width="100%" height="84%">
          <PieChart>
            <Pie data={org} dataKey="value" nameKey="name" innerRadius={64} outerRadius={108} paddingAngle={4}>
              {org.map((entry, index) => <Cell key={entry.name} fill={palette[index % palette.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className={cardClass("xl:col-span-4 h-80")}> 
        <p className="mb-4 text-sm font-black text-[#111827]">Attendance</p>
        <ResponsiveContainer width="100%" height="84%">
          <BarChart data={operations}>
            <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
            <Tooltip />
            <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="#4B46C6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className={cardClass("xl:col-span-4 h-80")}> 
        <p className="mb-4 text-sm font-black text-[#111827]">Leave Statistics</p>
        <ResponsiveContainer width="100%" height="84%">
          <PieChart>
            <Pie data={operations} dataKey="value" nameKey="name" outerRadius={90}>
              {operations.map((entry, index) => <Cell key={entry.name} fill={palette[(index + 2) % palette.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className={cardClass("xl:col-span-4 h-80")}> 
        <p className="mb-4 text-sm font-black text-[#111827]">Payroll</p>
        <ResponsiveContainer width="100%" height="84%">
          <LineChart data={payrollData}>
            <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
            <Tooltip />
            <Line type="monotone" dataKey="payroll" stroke="#2E2A8C" strokeWidth={3} dot={{ r: 3, fill: "#6D6AF8" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
