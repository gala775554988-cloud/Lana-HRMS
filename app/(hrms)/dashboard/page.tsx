import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardCharts } from "@/components/hrms/dashboard-charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, Calendar, DollarSign, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HrmsDashboard() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/login");
  }

  const roles = (session.user.roles as string[]) || [];
  
  // Only allow admin/HR roles
  const isAdmin = roles.some((role: string) => 
    ["SUPER_ADMIN", "HR_MANAGER", "PAYROLL_MANAGER", "RECRUITER", "MANAGER"].includes(role)
  );

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
          <p className="text-slate-600 mb-6">
            You do not have permission to access the HRMS Dashboard.
          </p>
          <a 
            href="/employee/dashboard" 
            className="inline-block px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
          >
            Go to Employee Portal
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">HRMS Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your organization's HR metrics</p>
        </div>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  let metrics: any = {
    employees: 0,
    departments: 0,
    openJobs: 0,
    pendingLeave: 0,
    unreadNotifications: 0,
    totalPayroll: 0,
  };

  try {
    const [
      employeesCount,
      departmentsCount,
      openJobsCount,
      pendingLeaveCount,
      notificationsCount,
      payrollSum,
    ] = await prisma.$transaction([
      prisma.employee.count({ where: { status: "ACTIVE" } }),
      prisma.department.count({ where: { isActive: true } }),
      prisma.jobOpening.count({ where: { status: "OPEN" } }),
      prisma.leaveRequest.count({ where: { status: "PENDING" } }),
      prisma.notification.count({ where: { readAt: null } }),
      prisma.payrollItem.aggregate({
        _sum: { netPay: true },
        where: { payrollRun: { status: "PAID" } },
      }),
    ]);

    metrics = {
      employees: employeesCount,
      departments: departmentsCount,
      openJobs: openJobsCount,
      pendingLeave: pendingLeaveCount,
      unreadNotifications: notificationsCount,
      totalPayroll: Number(payrollSum._sum.netPay || 0),
    };
  } catch (error) {
    console.error("[HRMS Dashboard] Error fetching metrics:", error);
    // Keep default metrics on error
  }

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KpiCard 
          title="Active Employees" 
          value={metrics.employees} 
          icon={<Users className="h-5 w-5" />} 
          description="Currently employed" 
        />
        <KpiCard 
          title="Departments" 
          value={metrics.departments} 
          icon={<Building2 className="h-5 w-5" />} 
          description="Active departments" 
        />
        <KpiCard 
          title="Open Positions" 
          value={metrics.openJobs} 
          icon={<TrendingUp className="h-5 w-5" />} 
          description="Currently hiring" 
        />
        <KpiCard 
          title="Pending Leave" 
          value={metrics.pendingLeave} 
          icon={<Calendar className="h-5 w-5" />} 
          description="Awaiting approval" 
        />
        <KpiCard 
          title="Total Payroll" 
          value={new Intl.NumberFormat("en-US", { 
            style: "currency", 
            currency: "SAR",
            maximumFractionDigits: 0 
          }).format(metrics.totalPayroll)} 
          icon={<DollarSign className="h-5 w-5" />} 
          description="Paid this period" 
        />
      </div>

      {/* Charts */}
      <DashboardCharts metrics={metrics} />

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <QuickLinkCard 
          title="Employees" 
          href="/employees" 
          description="Manage employee records" 
        />
        <QuickLinkCard 
          title="Leave Requests" 
          href="/leave-requests" 
          description="Review pending requests" 
        />
        <QuickLinkCard 
          title="Reports" 
          href="/reports" 
          description="Generate HR reports" 
        />
      </div>
    </div>
  );
}

function KpiCard({ 
  title, 
  value, 
  icon, 
  description 
}: { 
  title: string; 
  value: number | string; 
  icon: React.ReactNode; 
  description: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

function QuickLinkCard({ 
  title, 
  href, 
  description 
}: { 
  title: string; 
  href: string; 
  description: string;
}) {
  return (
    <a href={href} className="block">
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </a>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-32 rounded-lg border bg-muted" />
        ))}
      </div>
      <div className="h-96 rounded-lg border bg-muted" />
    </div>
  );
}
