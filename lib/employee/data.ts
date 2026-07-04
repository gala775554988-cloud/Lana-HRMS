import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import type { 
  EmployeeProfile, 
  AttendanceSummary, 
  LeaveBalance, 
  PayrollSummary, 
  RequestSummary, 
  TaskItem, 
  NotificationItem 
} from "@/types/employee";

export async function getCurrentEmployee() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const employee = await prisma.employee.findFirst({
    where: { userId: session.user.id },
    include: {
      department: true,
      position: true,
      branch: true,
    },
  });

  if (!employee) return null;

  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    nationalId: employee.nationalId,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone,
    profilePhotoUrl: employee.profilePhotoUrl,
    department: employee.department ? { name: employee.department.name, code: employee.department.code } : null,
    position: employee.position ? { title: employee.position.title } : null,
    branch: employee.branch ? { name: employee.branch.name } : null,
    hireDate: employee.hireDate,
    status: employee.status,
  } as EmployeeProfile;
}

export async function getAttendanceSummary(employeeId: string): Promise<AttendanceSummary> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const record = await prisma.attendanceRecord.findFirst({
    where: {
      employeeId,
      workDate: { gte: today },
    },
  });

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthRecords = await prisma.attendanceRecord.findMany({
    where: {
      employeeId,
      workDate: { gte: monthStart },
    },
  });

  let totalHours = 0;
  monthRecords.forEach(r => {
    if (r.checkIn && r.checkOut) {
      const diff = (new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / (1000 * 60 * 60);
      totalHours += Math.max(0, diff);
    }
  });

  return {
    todayStatus: record?.status === 'PRESENT' ? 'present' : record?.checkOut ? 'checked-out' : 'absent',
    checkIn: record?.checkIn?.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    checkOut: record?.checkOut?.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    hoursToday: record?.checkIn && record?.checkOut 
      ? Math.max(0, (new Date(record.checkOut).getTime() - new Date(record.checkIn).getTime()) / (1000 * 60 * 60)) 
      : 0,
    totalThisMonth: Math.round(totalHours),
  };
}

export async function getLeaveBalance(employeeId: string): Promise<LeaveBalance> {
  const leaveRequests = await prisma.leaveRequest.findMany({
    where: { employeeId, status: "APPROVED" },
    include: { leaveType: true },
  });

  let annualUsed = 0;
  let sickUsed = 0;

  leaveRequests.forEach(lr => {
    const days = Number(lr.days || 1);
    if (lr.leaveType?.name?.toLowerCase().includes('سنوية') || lr.leaveType?.code === 'ANNUAL') {
      annualUsed += days;
    } else if (lr.leaveType?.name?.toLowerCase().includes('مرضية')) {
      sickUsed += days;
    }
  });

  return {
    annual: { used: annualUsed, remaining: Math.max(30 - annualUsed, 0), total: 30 },
    sick: { used: sickUsed, remaining: Math.max(15 - sickUsed, 0), total: 15 },
  };
}

export async function getPayrollSummary(employeeId: string): Promise<PayrollSummary> {
  const latest = await prisma.payrollItem.findFirst({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
  });

  return {
    baseSalary: latest ? Number(latest.baseSalary) : 12500,
    currency: latest?.currency || "SAR",
    netPay: latest ? Number(latest.netPay || latest.baseSalary) : undefined,
    lastPayDate: latest?.createdAt.toISOString().slice(0, 10),
  } as const;
}

export async function getRequestSummary(employeeId: string): Promise<RequestSummary> {
  const [pending, approved, rejected] = await Promise.all([
    prisma.leaveRequest.count({ where: { employeeId, status: "PENDING" } }),
    prisma.leaveRequest.count({ where: { employeeId, status: "APPROVED" } }),
    prisma.leaveRequest.count({ where: { employeeId, status: "REJECTED" } }),
  ]);

  return { pending, approved, rejected };
}

export async function getRecentTasks(employeeId: string): Promise<TaskItem[]> {
  // Use leave requests + overtime as tasks for now (real data)
  const leaves = await prisma.leaveRequest.findMany({
    where: { employeeId, status: "PENDING" },
    take: 3,
    orderBy: { createdAt: "desc" },
  });

  const overtimes = await prisma.overtimeRequest.findMany({
    where: { employeeId, status: "PENDING" },
    take: 2,
  });

  const tasks: TaskItem[] = [
    ...leaves.map(l => ({
      id: l.id,
      title: `طلب إجازة: ${l.reason || 'غير محدد'}`,
      dueDate: l.startDate.toISOString().slice(0, 10),
      status: "pending" as const,
      priority: "medium" as const,
    })),
    ...overtimes.map(o => ({
      id: o.id,
      title: `طلب ساعات إضافية (${Number(o.hours)} ساعات)`,
      dueDate: o.workDate.toISOString().slice(0, 10),
      status: "pending" as const,
      priority: "high" as const,
    })),
  ];

  return tasks.slice(0, 5);
}

export async function getRecentNotifications(employeeId: string): Promise<NotificationItem[]> {
  const logs = await prisma.auditLog.findMany({
    where: { entity: { in: ["leave", "loan", "overtime"] }, metadata: { path: ["employeeId"], equals: employeeId } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return logs.map(log => ({
    id: log.id,
    title: `تم ${log.action === 'create' ? 'تقديم' : 'تحديث'} ${log.entity}`,
    message: log.entity,
    createdAt: log.createdAt.toISOString(),
    read: false,
    type: log.entity,
  }));
}
