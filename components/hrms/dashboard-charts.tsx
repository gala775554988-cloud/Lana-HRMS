'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function DashboardCharts({ metrics }: { metrics: Record<string, unknown> }) {
  const data = [
    { name: "Employees", value: Number(metrics.employees ?? 0) },
    { name: "Departments", value: Number(metrics.departments ?? 0) },
    { name: "Open Jobs", value: Number(metrics.openJobs ?? 0) },
    { name: "Leave", value: Number(metrics.pendingLeave ?? 0) },
    { name: "Notifications", value: Number(metrics.unreadNotifications ?? 0) }
  ];
  return (
    <div className="h-80 rounded-lg border bg-background p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
