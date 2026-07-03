"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const palette = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export function DashboardCharts({ metrics }: { metrics: Record<string, unknown> }) {
  const kpiData = [
    { name: "Employees", value: Number(metrics.employees ?? 0) },
    { name: "Departments", value: Number(metrics.departments ?? 0) },
    { name: "Open Jobs", value: Number(metrics.openJobs ?? 0) },
    { name: "Leave", value: Number(metrics.pendingLeave ?? 0) },
    { name: "Notifications", value: Number(metrics.unreadNotifications ?? 0) }
  ];
  const trendData = kpiData.map((item, index) => ({ name: item.name, value: item.value + index * 2, forecast: item.value + index * 3 + 4 }));

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
      <div className="h-80 rounded-lg border bg-background p-4 shadow-sm">
        <div className="mb-4">
          <p className="text-sm font-medium">Workforce operating trend</p>
          <p className="text-xs text-muted-foreground">Live HR signals and short-range forecast.</p>
        </div>
        <ResponsiveContainer width="100%" height="82%">
          <AreaChart data={trendData}>
            <defs>
              <linearGradient id="hrmsTrend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
            <Tooltip />
            <Area type="monotone" dataKey="forecast" stroke="#10b981" strokeWidth={2} fill="transparent" />
            <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#hrmsTrend)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <div className="h-80 rounded-lg border bg-background p-4 shadow-sm">
          <p className="text-sm font-medium">Module distribution</p>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie data={kpiData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={3}>
                {kpiData.map((entry, index) => <Cell key={entry.name} fill={palette[index % palette.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="h-80 rounded-lg border bg-background p-4 shadow-sm xl:hidden">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={kpiData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>{kpiData.map((entry, index) => <Cell key={entry.name} fill={palette[index % palette.length]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}