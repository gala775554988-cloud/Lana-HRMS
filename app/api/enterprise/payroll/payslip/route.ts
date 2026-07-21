import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { canAccessEmployeeId, getAccessProfile } from "@/lib/enterprise/hierarchy";
import { getCompanyLogo, getAppSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const itemId = request.nextUrl.searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ success: false, message: "itemId is required" }, { status: 400 });

  const item = await prisma.payrollItem.findUnique({
    where: { id: itemId },
    include: {
      employee: {
        select: {
          id: true, employeeNumber: true, firstName: true, lastName: true, nationalId: true,
          department: { select: { name: true } }, position: { select: { title: true } }, branch: { select: { name: true } },
          bankAccounts: { where: { isPrimary: true }, take: 1 }
        }
      },
      payrollRun: { select: { name: true, period: true, status: true, paidAt: true } },
      costCenter: { select: { name: true } }
    }
  });
  if (!item) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

  const roles = (session.user.roles as string[] | undefined) ?? [];
  const permissions = (session.user.permissions as string[] | undefined) ?? [];
  const isSelf = false; // employee-portal payslip access goes through a separate, already-existing route (app/api/employee/payslip)
  const isHrOrPayroll = roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || roles.includes("PAYROLL_OFFICER") || hasPermission(permissions, { action: "read", resource: "payroll" });
  if (!isSelf && !isHrOrPayroll) {
    const profile = await getAccessProfile(session.user.id, roles);
    if (!profile.isSuperAdmin && !profile.isHrManager && !(await canAccessEmployeeId(item.employeeId, profile))) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
  }

  const [logo, companyName] = await Promise.all([
    getCompanyLogo().catch(() => null),
    getAppSetting("company.name").catch(() => null)
  ]);

  const qrPayload = `LANA-PAYSLIP|${item.employee.employeeNumber}|${item.payrollRun.period}|${Number(item.netPay).toFixed(2)}|${item.id}`;
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 160 }).catch(() => null);

  return NextResponse.json({
    success: true,
    companyName: (companyName as string | null) ?? "Lana HRMS",
    companyLogo: logo,
    qrDataUrl,
    item: {
      id: item.id,
      period: item.payrollRun.period,
      runName: item.payrollRun.name,
      runStatus: item.payrollRun.status,
      paidAt: item.payrollRun.paidAt,
      currency: item.currency,
      baseSalary: Number(item.baseSalary),
      allowanceTotal: Number(item.allowanceTotal),
      bonusTotal: Number(item.bonusTotal),
      overtimeTotal: Number(item.overtimeTotal),
      grossPay: Number(item.grossPay),
      insuranceDeduction: Number(item.insuranceDeduction),
      taxTotal: Number(item.taxTotal),
      loanDeduction: Number(item.loanDeduction),
      advanceDeduction: Number(item.advanceDeduction),
      absenceDeduction: Number(item.absenceDeduction),
      lateDeduction: Number(item.lateDeduction),
      penaltyDeduction: Number(item.penaltyDeduction),
      deductionTotal: Number(item.deductionTotal),
      netPay: Number(item.netPay),
      costCenter: item.costCenter?.name ?? null
    },
    employee: {
      employeeNumber: item.employee.employeeNumber,
      name: `${item.employee.firstName} ${item.employee.lastName}`,
      nationalId: item.employee.nationalId,
      department: item.employee.department?.name ?? null,
      position: item.employee.position?.title ?? null,
      branch: item.employee.branch?.name ?? null,
      bank: item.employee.bankAccounts[0]?.bank ?? null,
      iban: item.employee.bankAccounts[0]?.iban ?? null
    }
  });
}
