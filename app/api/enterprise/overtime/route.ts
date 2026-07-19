import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { applyScopedWhere, canAccessEmployeeId, getAccessProfile, resolveRoleEmployeeIds } from "@/lib/enterprise/hierarchy";
import { createEnterpriseNotification } from "@/lib/enterprise/notifications";
import { getEmployeeExtraSettings } from "@/lib/enterprise/hospitals";
import { calculateNetSalary } from "@/lib/employee/salary-profile";
import { getEmployeeSalaryProfile } from "@/lib/employee/salary-profile-store";
import { writeAuditLog } from "@/lib/audit";

function canManageOvertime(session: any) {
  const roles = (session?.user?.roles as string[]) ?? [];
  const permissions = (session?.user?.permissions as string[]) ?? [];
  return roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || hasPermission(permissions, { action: "manage", resource: "overtime" });
}

function parseDate(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function monthRange(value: string | null) {
  if (!value) return null;
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return null;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

function calculateHours(startTime: string, endTime: string, fallback?: number) {
  if (!startTime || !endTime) return Number(fallback ?? 0);
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  if ([startHour, startMinute, endHour, endMinute].some((part) => Number.isNaN(part))) return Number(fallback ?? 0);
  let minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  if (minutes < 0) minutes += 24 * 60;
  return Number((minutes / 60).toFixed(2));
}

function overtimeMultiplier(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes("holiday") || normalized.includes("عطلة") || normalized.includes("weekend")) return 2;
  if (normalized.includes("night") || normalized.includes("ليل")) return 1.75;
  return 1.5;
}

async function calculateOvertimeAmount(employeeId: string, hours: number, type: string) {
  const salary = await getEmployeeSalaryProfile(employeeId);
  const monthlySalary = calculateNetSalary(salary);
  const hourlyRate = monthlySalary > 0 ? monthlySalary / 240 : 0;
  return Number((hourlyRate * hours * overtimeMultiplier(type)).toFixed(2));
}

async function getEmployeeScope(userId: string, roles: string[]) {
  const profile = await getAccessProfile(userId, roles);
  return applyScopedWhere("employees", {}, profile);
}

async function createHrOnlyWorkflow(employeeId: string, entityId: string, actorUserId: string) {
  const hrEmployees = await resolveRoleEmployeeIds(["HR_MANAGER"]);
  const approverUserIds = Array.from(new Set(hrEmployees.map((employee) => employee.userId).filter((id): id is string => Boolean(id))));
  const instance = await prisma.workflowInstance.create({
    data: {
      employeeId,
      type: "OVERTIME",
      entityId,
      status: approverUserIds.length ? "PENDING" : "COMPLETED",
      currentStep: approverUserIds.length ? 1 : 0
    }
  });
  if (approverUserIds.length) {
    await prisma.workflowStep.createMany({
      data: approverUserIds.map((approverUserId, index) => ({
        workflowInstanceId: instance.id,
        step: index + 1,
        approverUserId,
        status: index === 0 ? "PENDING" : "WAITING"
      }))
    });
    await Promise.all(approverUserIds.slice(0, 1).map((userId) => createEnterpriseNotification({ userId, title: "طلب أوفر تايم جديد", body: "يوجد طلب أوفر تايم بانتظار اعتمادك.", type: "INFO", link: `/approvals?tab=inbox&highlight=${instance.id}` })));
  } else {
    await prisma.overtimeRequest.update({ where: { id: entityId }, data: { status: "APPROVED" } }).catch(() => null);
  }
  await writeAuditLog({ actorUserId, action: "overtime:workflow-create", entity: "workflowInstance", entityId: instance.id, metadata: { employeeId, entityId, approverUserIds } }).catch(() => null);
  return instance;
}

async function listData(session: any, request: NextRequest) {
  const roles = (session.user.roles as string[]) ?? [];
  const employeeWhere = await getEmployeeScope(session.user.id, roles);
  const searchParams = request.nextUrl.searchParams;
  const from = parseDate(searchParams.get("from"));
  const to = parseDate(searchParams.get("to"));
  const month = monthRange(searchParams.get("month"));
  const hospital = searchParams.get("hospital") ?? "";
  const department = searchParams.get("department") ?? "";
  const branch = searchParams.get("branch") ?? "";
  const approvedOnly = searchParams.get("approved") === "true";

  const employeeAnd: any[] = [employeeWhere];
  if (department) employeeAnd.push({ department: { name: { contains: department, mode: "insensitive" } } });
  if (branch) employeeAnd.push({ branch: { name: { contains: branch, mode: "insensitive" } } });
  if (hospital) {
    const extra = await getEmployeeExtraSettings();
    const ids = extra.filter((item) => String(item.value.hospital ?? "").toLowerCase().includes(hospital.toLowerCase())).map((item) => item.employeeId);
    employeeAnd.push({ id: { in: ids.length ? ids : ["__NO_HOSPITAL__"] } });
  }

  const dateWhere: any = {};
  if (from) dateWhere.gte = from;
  if (to) dateWhere.lte = to;
  if (month) {
    dateWhere.gte = month.start;
    dateWhere.lt = month.end;
  }

  const overtime = await prisma.overtimeRequest.findMany({
    where: {
      employee: { AND: employeeAnd },
      ...(Object.keys(dateWhere).length ? { workDate: dateWhere } : {}),
      ...(approvedOnly ? { status: "APPROVED" } : {})
    },
    include: {
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          nationalId: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
          branch: { select: { name: true } },
          position: { select: { title: true } }
        }
      }
    },
    orderBy: { workDate: "desc" },
    take: 500
  });

  const extras = await prisma.appSetting.findMany({ where: { key: { in: overtime.flatMap((item) => [`overtime.extra.${item.id}`, `employee.extra.${item.employeeId}`, `employee.salary.${item.employeeId}`]) } } });
  const settingMap = new Map(extras.map((setting) => [setting.key, setting.value]));

  const rows = overtime.map((item) => ({
    ...item,
    extra: settingMap.get(`overtime.extra.${item.id}`) ?? {},
    employeeExtra: settingMap.get(`employee.extra.${item.employeeId}`) ?? {},
    salary: settingMap.get(`employee.salary.${item.employeeId}`) ?? {}
  }));

  return { rows };
}

function exportWorkbook(rows: any[]) {
  const data = rows.map((row) => {
    const extra = row.extra as any;
    const employeeExtra = row.employeeExtra as any;
    const salary = row.salary as any;
    const allowances = Number(salary.salaryHousingAllowance ?? 0) + Number(salary.salaryTransportAllowance ?? 0) + Number(salary.salaryFoodAllowance ?? 0) + Number(salary.salaryCommunicationAllowance ?? 0) + Number(salary.salaryOtherAllowances ?? 0);
    return {
      "الرقم الوظيفي": row.employee.employeeNumber,
      "الاسم الكامل": `${row.employee.firstName} ${row.employee.lastName}`,
      "رقم الهوية": row.employee.nationalId,
      "المسمى الوظيفي": row.employee.position?.title ?? "",
      "القسم": row.employee.department?.name ?? "",
      "الفرع": row.employee.branch?.name ?? "",
      "المستشفى": extra.hospital ?? employeeExtra.hospital ?? "",
      "عدد ساعات الأوفر تايم": Number(row.hours),
      "قيمة الأوفر تايم": Number(extra.amount ?? 0),
      "الراتب الأساسي": Number(salary.salaryBase ?? 0),
      "البدلات": allowances,
      "إجمالي الراتب": Number(salary.salaryTotal ?? salary.salaryNet ?? 0),
      "IBAN": employeeExtra.iban ?? "",
      "اسم البنك": employeeExtra.bankName ?? "",
      "تاريخ الأوفر تايم": new Date(row.workDate).toISOString().slice(0, 10)
    };
  });
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Approved Overtime");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canManageOvertime(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const { rows } = await listData(session, request);
  if (request.nextUrl.searchParams.get("export") === "excel") {
    const buffer = exportWorkbook(rows.filter((row) => row.status === "APPROVED"));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=approved-overtime.xlsx"
      }
    });
  }

  const employees = await prisma.employee.findMany({
    where: await getEmployeeScope(session.user.id, (session.user.roles as string[]) ?? []),
    select: { id: true, employeeNumber: true, firstName: true, lastName: true, departmentId: true, branchId: true, department: { select: { name: true } }, branch: { select: { name: true } } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 500
  });
  const [departments, branches] = await Promise.all([
    prisma.department.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } })
  ]);

  return NextResponse.json({ success: true, overtime: rows, employees, departments, branches });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canManageOvertime(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const body = await request.json() as {
    employeeId: string;
    workDate: string;
    startTime: string;
    endTime: string;
    hours?: number;
    overtimeType: string;
    notes?: string;
    project?: string;
    hospital?: string;
    departmentId?: string;
    branchId?: string;
  };

  const roles = (session.user.roles as string[]) ?? [];
  const profile = await getAccessProfile(session.user.id, roles);
  if (!(await canAccessEmployeeId(body.employeeId, profile))) return NextResponse.json({ success: false, message: "Forbidden employee scope" }, { status: 403 });

  const hours = calculateHours(body.startTime, body.endTime, body.hours);
  const amount = await calculateOvertimeAmount(body.employeeId, hours, body.overtimeType || "regular");
  const rate = overtimeMultiplier(body.overtimeType || "regular");

  const overtime = await prisma.overtimeRequest.create({
    data: {
      employeeId: body.employeeId,
      workDate: new Date(body.workDate),
      hours,
      rate,
      reason: body.notes ?? "",
      status: "PENDING"
    }
  });

  await prisma.appSetting.upsert({
    where: { key: `overtime.extra.${overtime.id}` },
    update: { value: { ...body, amount, rate } as any },
    create: { key: `overtime.extra.${overtime.id}`, value: { ...body, amount, rate } as any, description: "Overtime extra details" }
  });
  await createHrOnlyWorkflow(body.employeeId, overtime.id, session.user.id);
  await writeAuditLog({ actorUserId: session.user.id, action: "overtime:create", entity: "overtimeRequest", entityId: overtime.id, metadata: { amount, hours, rate } }).catch(() => null);

  return NextResponse.json({ success: true, overtime, amount });
}
