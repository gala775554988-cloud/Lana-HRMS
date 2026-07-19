import { z } from "zod";
import { tool } from "ai";
import { prisma } from "@/lib/prisma";
import { memoryCache } from "@/lib/cache/memory-cache";
import { applyScopedWhere } from "@/lib/enterprise/hierarchy";

export type ToolAuthContext = {
  userId: string;
  roles: string[];
  permissions: string[];
  departmentId?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  isExecutive?: boolean;
  isDelegate?: boolean;
  selectedEmployeeId?: string | null;
  selectedEmployeeName?: string | null;
};

function canManageHr(context: ToolAuthContext) {
  return context.roles.includes("SUPER_ADMIN") || context.roles.includes("HR_MANAGER") || context.permissions.includes("manage:employees");
}

function canViewAllEmployees(context: ToolAuthContext) {
  return canManageHr(context) || context.permissions.includes("read:employees");
}

function makeTool(config: any) {
  return tool({
    description: config.description,
    parameters: config.parameters,
    inputSchema: config.parameters,
    execute: config.execute
  } as any);
}

export function createScopedHrTools(context: ToolAuthContext) {
  return {
    getEmployeeProfile: makeTool({
      description: "جلب بيانات الموظف بناءً على الرقم الوظيفي أو الهوية أو الاسم / Retrieve employee profile details by employee ID or name.",
      parameters: z.object({
        employeeId: z.string().optional().describe("The employee ID or barcode."),
        identifier: z.string().optional().describe("ID, national ID, or name.")
      }) as any,
      execute: async ({ employeeId, identifier }: any) => {
        const queryId = employeeId || identifier;
        if (!queryId && !context.employeeId) return { error: "يرجى تحديد رقم أو اسم الموظف." };
        const target = queryId || context.employeeId!;

        return memoryCache(`tool:emp_profile:${target}:${context.userId}`, 60_000, async () => {
          const emp = await prisma.employee.findFirst({
            where: {
              OR: [
                { id: target },
                { nationalId: target },
                { employeeNumber: target },
                { firstName: { contains: target, mode: "insensitive" } },
                { lastName: { contains: target, mode: "insensitive" } }
              ]
            },
            include: {
              department: { select: { name: true, code: true } },
              position: { select: { title: true } },
              branch: { select: { name: true } },
              manager: { select: { firstName: true, lastName: true, employeeNumber: true } }
            }
          });
          if (!emp) return { error: `لم يتم العثور على موظف برقم أو اسم "${target}" في قاعدة البيانات.` };

          if (!canViewAllEmployees(context) && emp.id !== context.employeeId && emp.managerId !== context.employeeId) {
            return { error: "عذراً: ليس لديك صلاحية لعرض بيانات هذا الموظف." };
          }

          let liveMetrics: any = null;
          if (emp.odooId) {
            try {
              const { OdooSyncService } = await import("@/lib/integrations/odoo/sync");
              const service = await OdooSyncService.forConnection();
              liveMetrics = await service.fetchLiveOdooMetrics(emp.odooId);
            } catch {}
          }

          return {
            id: emp.id,
            employeeNumber: emp.employeeNumber,
            nationalId: canManageHr(context) || emp.id === context.employeeId ? emp.nationalId : "REDACTED",
            name: `${emp.firstName} ${emp.lastName}`.trim(),
            email: emp.email || "-",
            phone: emp.phone || "-",
            department: emp.department?.name || "بدون قسم",
            position: emp.position?.title || "بدون مسمى",
            branch: emp.branch?.name || "الفرع الرئيسي",
            manager: emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : "لا يوجد",
            status: emp.status === "ACTIVE" ? "على رأس العمل" : "غير نشط",
            hireDate: emp.hireDate.toLocaleDateString("ar-SA"),
            liveWage: liveMetrics?.liveWage ? `${liveMetrics.liveWage} SAR (Odoo Real-time Bridge)` : undefined
          };
        });
      }
    }),

    getEmployee: makeTool({
      description: "Retrieve comprehensive details for a specific employee by ID, national ID, or employee number.",
      parameters: z.object({
        identifier: z.string().describe("The ID, national ID, or employee number (barcode) of the employee.")
      }) as any,
      execute: async ({ identifier }: any) => {
        const emp = await prisma.employee.findFirst({
          where: {
            OR: [
              { id: identifier },
              { nationalId: identifier },
              { employeeNumber: identifier }
            ]
          },
          include: {
            department: { select: { name: true, code: true } },
            position: { select: { title: true } },
            branch: { select: { name: true } },
            manager: { select: { firstName: true, lastName: true, employeeNumber: true } }
          }
        });
        if (!emp) return { error: "Employee not found in database." };

        if (!canViewAllEmployees(context) && emp.id !== context.employeeId && emp.managerId !== context.employeeId) {
          return { error: "Access Denied: You only have permission to view your own record or your direct reports." };
        }

        return {
          id: emp.id,
          employeeNumber: emp.employeeNumber,
          nationalId: canManageHr(context) || emp.id === context.employeeId ? emp.nationalId : "REDACTED",
          name: `${emp.firstName} ${emp.lastName}`.trim(),
          email: emp.email,
          phone: emp.phone,
          department: emp.department?.name || "Unassigned",
          position: emp.position?.title || "Unassigned",
          branch: emp.branch?.name || "Main",
          manager: emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : "None",
          status: emp.status,
          hireDate: emp.hireDate
        };
      }
    }),

    searchEmployeeData: makeTool({
      description: "أداة البحث المباشر في قاعدة بيانات الموظفين (Prisma/Neon) بالاسم أو الرقم الوظيفي لاستخراج بيانات دقيقة مثل رقم الهوية أو القسم أو المسمى الوظيفي. Direct Prisma-backed lookup by name or employee number -- use this whenever the user asks for a specific fact about a named employee (e.g. their national ID).",
      parameters: z.object({
        query: z.string().describe("Employee full/partial name or employee number to search for.")
      }) as any,
      execute: async ({ query }: any) => {
        const trimmed = (query || "").trim();
        if (!trimmed) return { error: "يرجى تحديد اسم أو رقم الموظف للبحث." };
        if (!canViewAllEmployees(context) && !context.employeeId) {
          return { error: "Access Denied: Insufficient permissions to search employees." };
        }

        return memoryCache(`tool:search_emp_data:${trimmed}:${context.userId}`, 30_000, async () => {
          // Multi-word Arabic names often span both firstName and lastName
          // (e.g. "عبد الرحمن الجماعي") -- require every word to independently
          // match one of the two fields rather than a single contiguous
          // substring, so compound first names still resolve precisely.
          const words = trimmed.split(/\s+/).filter(Boolean);
          const multiWordCondition = words.length > 1
            ? [{ AND: words.map((word: string) => ({ OR: [{ firstName: { contains: word, mode: "insensitive" } }, { lastName: { contains: word, mode: "insensitive" } }] })) }]
            : [];

          const employees = await prisma.employee.findMany({
            where: {
              OR: [
                { employeeNumber: { contains: trimmed, mode: "insensitive" } },
                { nationalId: trimmed },
                { firstName: { contains: trimmed, mode: "insensitive" } },
                { lastName: { contains: trimmed, mode: "insensitive" } },
                ...multiWordCondition
              ]
            },
            take: 5,
            include: {
              department: { select: { name: true } },
              position: { select: { title: true } }
            }
          });

          if (!employees.length) return { error: `لم يتم العثور على موظف مطابق لـ "${trimmed}".`, employees: [] };

          const canSeeSensitive = canManageHr(context);
          return {
            count: employees.length,
            employees: employees.map((e) => ({
              id: e.id,
              employeeNumber: e.employeeNumber,
              name: `${e.firstName} ${e.lastName}`.trim(),
              nationalId: canSeeSensitive || e.id === context.employeeId ? e.nationalId : "REDACTED",
              department: e.department?.name || "بدون قسم",
              position: e.position?.title || "بدون مسمى",
              status: e.status
            }))
          };
        });
      }
    }),

    searchEmployees: makeTool({
      description: "Search for employees by name, number, department, or status. Returns a scoped list based on the caller's permissions.",
      parameters: z.object({
        query: z.string().optional().describe("Search string matching name or number."),
        departmentName: z.string().optional().describe("Filter by department name."),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional().describe("Filter by employee status.")
      }) as any,
      execute: async ({ query, departmentName, status }: any) => {
        if (!canViewAllEmployees(context) && !context.employeeId) {
          return { error: "Access Denied: Insufficient permissions to search employees." };
        }

        const where: any = {};
        if (query) {
          where.OR = [
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { employeeNumber: { contains: query, mode: "insensitive" } }
          ];
        }
        if (departmentName) {
          where.department = { name: { contains: departmentName, mode: "insensitive" } };
        }
        if (status) {
          where.status = status;
        }

        if (!canViewAllEmployees(context)) {
          where.OR = [
            { id: context.employeeId },
            { managerId: context.employeeId }
          ];
        }

        const list = await prisma.employee.findMany({
          where,
          take: 15,
          orderBy: { firstName: "asc" },
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            position: { select: { title: true } },
            status: true
          }
        });

        return {
          count: list.length,
          employees: list.map((e) => ({
            id: e.id,
            employeeNumber: e.employeeNumber,
            name: `${e.firstName} ${e.lastName}`,
            department: e.department?.name || "Unassigned",
            position: e.position?.title || "Unassigned",
            status: e.status
          }))
        };
      }
    }),

    createEmployee: makeTool({
      description: "Create a new employee record in the HR database.",
      parameters: z.object({
        employeeNumber: z.string(),
        nationalId: z.string(),
        firstName: z.string(),
        lastName: z.string().default(""),
        email: z.string().optional(),
        phone: z.string().optional(),
        departmentName: z.string().optional(),
        positionTitle: z.string().optional()
      }) as any,
      execute: async (params: any) => {
        if (!canManageHr(context)) return { error: "Access Denied: Only HR Managers or Super Admins can create employees." };
        try {
          const created = await prisma.employee.create({
            data: {
              employeeNumber: params.employeeNumber,
              nationalId: params.nationalId,
              firstName: params.firstName,
              lastName: params.lastName || "",
              email: params.email || null,
              phone: params.phone || null,
              hireDate: new Date(),
              status: "ACTIVE"
            }
          });
          return { success: true, employeeId: created.id, message: `Created employee #${created.employeeNumber}: ${created.firstName} ${created.lastName}` };
        } catch (err: any) {
          return { error: `Failed to create employee: ${err.message}` };
        }
      }
    }),

    updateEmployee: makeTool({
      description: "Update fields on an existing employee record.",
      parameters: z.object({
        identifier: z.string().describe("Employee ID or employee number."),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional()
      }) as any,
      execute: async ({ identifier, ...updates }: any) => {
        const emp = await prisma.employee.findFirst({ where: { OR: [{ id: identifier }, { employeeNumber: identifier }] } });
        if (!emp) return { error: "Employee not found." };
        if (!canManageHr(context) && emp.id !== context.employeeId) {
          return { error: "Access Denied: You cannot update another employee's record." };
        }
        if (!canManageHr(context) && updates.status) {
          return { error: "Access Denied: Only HR Managers can change employment status." };
        }
        const updated = await prisma.employee.update({
          where: { id: emp.id },
          data: updates
        });
        return { success: true, message: `Updated employee ${updated.firstName} ${updated.lastName}` };
      }
    }),

    deleteEmployee: makeTool({
      description: "Archive or delete an employee record.",
      parameters: z.object({
        identifier: z.string().describe("Employee ID or employee number.")
      }) as any,
      execute: async ({ identifier }: any) => {
        if (!canManageHr(context)) return { error: "Access Denied: Only HR Managers can delete employees." };
        const emp = await prisma.employee.findFirst({ where: { OR: [{ id: identifier }, { employeeNumber: identifier }] } });
        if (!emp) return { error: "Employee not found." };
        await prisma.employee.update({ where: { id: emp.id }, data: { status: "INACTIVE" } });
        return { success: true, message: `Archived employee #${emp.employeeNumber}: ${emp.firstName} ${emp.lastName}` };
      }
    }),

    getAttendance: makeTool({
      description: "Retrieve recent attendance records (check-in, check-out, status) for an employee.",
      parameters: z.object({
        employeeId: z.string().optional().describe("Employee ID. Defaults to current logged-in employee if omitted."),
        days: z.number().optional().default(7).describe("Number of recent days to retrieve.")
      }) as any,
      execute: async ({ employeeId, days }: any) => {
        const targetId = employeeId || context.employeeId;
        if (!targetId) return { error: "No employee ID provided or linked to current user." };
        if (!canManageHr(context) && targetId !== context.employeeId) {
          return { error: "Access Denied: You can only view your own attendance." };
        }
        const since = new Date();
        since.setDate(since.getDate() - (days || 7));

        const records = await prisma.attendanceRecord.findMany({
          where: { employeeId: targetId, workDate: { gte: since } },
          orderBy: { workDate: "desc" },
          take: 30
        });

        return {
          count: records.length,
          records: records.map((r) => ({
            date: r.workDate.toLocaleDateString("ar-SA"),
            checkIn: r.checkIn ? r.checkIn.toLocaleTimeString("ar-SA") : "-",
            checkOut: r.checkOut ? r.checkOut.toLocaleTimeString("ar-SA") : "-",
            status: r.status,
            notes: r.notes || ""
          }))
        };
      }
    }),

    checkIn: makeTool({
      description: "Record a daily check-in (attendance punch) for the current employee.",
      parameters: z.object({
        notes: z.string().optional().describe("Optional check-in note or location.")
      }) as any,
      execute: async ({ notes }: any) => {
        if (!context.employeeId) return { error: "Your user account is not linked to an employee profile." };
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const now = new Date();
        const record = await prisma.attendanceRecord.upsert({
          where: { employeeId_workDate: { employeeId: context.employeeId, workDate: today } },
          update: { checkIn: now, status: "PRESENT", notes: notes || "AI check-in" },
          create: { employeeId: context.employeeId, workDate: today, checkIn: now, status: "PRESENT", notes: notes || "AI check-in" }
        });
        return { success: true, message: `Recorded check-in at ${now.toLocaleTimeString("ar-SA")}`, recordId: record.id };
      }
    }),

    checkOut: makeTool({
      description: "Record a daily check-out for the current employee.",
      parameters: z.object({
        notes: z.string().optional()
      }) as any,
      execute: async ({ notes }: any) => {
        if (!context.employeeId) return { error: "Your user account is not linked to an employee profile." };
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const now = new Date();
        const record = await prisma.attendanceRecord.upsert({
          where: { employeeId_workDate: { employeeId: context.employeeId, workDate: today } },
          update: { checkOut: now, notes: notes || "AI check-out" },
          create: { employeeId: context.employeeId, workDate: today, checkOut: now, status: "PRESENT", notes: notes || "AI check-out" }
        });
        return { success: true, message: `Recorded check-out at ${now.toLocaleTimeString("ar-SA")}`, recordId: record.id };
      }
    }),

    getLeaveBalance: makeTool({
      description: "جلب رصيد إجازات الموظف بناءً على الاسم أو الرقم الوظيفي / Check annual leave balance and remaining days.",
      parameters: z.object({
        employeeId: z.string().optional().describe("Employee ID or number."),
        employeeName: z.string().optional().describe("Employee name.")
      }) as any,
      execute: async ({ employeeId, employeeName }: any) => {
        const cacheKeyTarget = employeeId || employeeName || context.selectedEmployeeId || context.employeeId || "self";
        return memoryCache(`tool:leave_bal:${cacheKeyTarget}:${context.userId}`, 30_000, async () => {
          let targetId = employeeId || context.selectedEmployeeId;
          let targetEmp: any = null;
          if (!targetId && employeeName) {
            targetEmp = await prisma.employee.findFirst({
              where: {
                OR: [
                  { firstName: { contains: employeeName, mode: "insensitive" } },
                  { lastName: { contains: employeeName, mode: "insensitive" } },
                  { employeeNumber: { contains: employeeName } }
                ]
              }
            });
            if (!targetEmp) return { error: `لم يتم العثور على موظف باسم "${employeeName}".` };
            targetId = targetEmp.id;
          }
          targetId = targetId || context.employeeId;
          if (!targetId) return { error: "يرجى تحديد اسم أو رقم الموظف للاستعلام عن رصيد إجازته." };
          if (!canManageHr(context) && targetId !== context.employeeId) {
            return { error: "عذراً: ليس لديك صلاحية للاستعلام عن رصيد إجازة هذا الموظف." };
          }
          if (!targetEmp) targetEmp = await prisma.employee.findUnique({ where: { id: targetId }, select: { firstName: true, lastName: true, employeeNumber: true, odooId: true, odooRawData: true } });
          const raw = targetEmp?.odooRawData as any || {};
          const csv = raw._csvLeaveData || {};

          if (typeof csv.daysRemaining === "number" || typeof raw.leaveRemaining === "number") {
            const annualEntitlement = Number(csv.daysAccrued ?? raw.leaveBalance ?? 30);
            const effectiveUsed = Number(csv.daysUsed ?? raw.leaveUsed ?? 0);
            const remainingDays = Number(csv.daysRemaining ?? raw.leaveRemaining ?? 0);
            return {
              employeeName: targetEmp ? `${targetEmp.firstName} ${targetEmp.lastName}` : targetId,
              employeeNumber: targetEmp?.employeeNumber || "-",
              annualEntitlement,
              usedDays: effectiveUsed,
              remainingDays,
              monthsAccrued: Number(csv.monthsAccrued ?? raw.leaveMonthsAccrued ?? 0),
              source: "سجل الأرصدة المعتمد من الموارد البشرية (CSV Leave Master)",
              pendingRequestsCount: await prisma.leaveRequest.count({ where: { employeeId: targetId, status: "PENDING" } })
            };
          }

          const requests = await prisma.leaveRequest.findMany({
            where: { employeeId: targetId, status: "APPROVED" }
          });
          const used = requests.reduce((sum, r) => sum + Math.max(1, Math.round((r.endDate.getTime() - r.startDate.getTime()) / (1000 * 60 * 60 * 24))), 0);
          const annualEntitlement = 30;

          let liveOdooUsed: number | null = null;
          if (targetEmp?.odooId) {
            try {
              const { OdooSyncService } = await import("@/lib/integrations/odoo/sync");
              const service = await OdooSyncService.forConnection();
              const metrics = await service.fetchLiveOdooMetrics(targetEmp.odooId);
              if (metrics && typeof metrics.usedLeaveDays === "number") liveOdooUsed = metrics.usedLeaveDays;
            } catch {}
          }

          const effectiveUsed = liveOdooUsed !== null ? liveOdooUsed : used;
          return {
            employeeName: targetEmp ? `${targetEmp.firstName} ${targetEmp.lastName}` : targetId,
            employeeNumber: targetEmp?.employeeNumber || "-",
            annualEntitlement,
            usedDays: effectiveUsed,
            remainingDays: Math.max(0, annualEntitlement - effectiveUsed),
            source: liveOdooUsed !== null ? "Real-time Odoo Bridge (مباشر من Odoo)" : "Neon Database",
            pendingRequestsCount: await prisma.leaveRequest.count({ where: { employeeId: targetId, status: "PENDING" } })
          };
        });
      }
    }),

    createLeaveRequest: makeTool({
      description: "Submit a new leave request (annual, sick, emergency, unpaid) for the current employee.",
      parameters: z.object({
        startDate: z.string().describe("Start date in YYYY-MM-DD format."),
        endDate: z.string().describe("End date in YYYY-MM-DD format."),
        leaveType: z.string().default("Annual Leave").describe("Type of leave requested."),
        reason: z.string().optional().describe("Reason for leave.")
      }) as any,
      execute: async ({ startDate, endDate, leaveType, reason }: any) => {
        if (!context.employeeId) return { error: "Your user account is not linked to an employee profile." };
        try {
          const s = new Date(startDate);
          const e = new Date(endDate);
          if (isNaN(s.getTime()) || isNaN(e.getTime())) return { error: "Invalid date format. Use YYYY-MM-DD." };
          
          let typeRecord = await prisma.leaveType.findFirst({ where: { name: { contains: leaveType, mode: "insensitive" } } });
          if (!typeRecord) {
            typeRecord = await prisma.leaveType.findFirst();
          }
          if (!typeRecord) return { error: "No leave types configured in system." };

          const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));

          const req = await prisma.leaveRequest.create({
            data: {
              employeeId: context.employeeId,
              leaveTypeId: typeRecord.id,
              startDate: s,
              endDate: e,
              days,
              reason: reason || `Requested via Lana AI (${leaveType})`,
              status: "PENDING"
            }
          });
          return { success: true, message: `Created leave request from ${startDate} to ${endDate} (${leaveType})`, requestId: req.id };
        } catch (err: any) {
          return { error: err.message };
        }
      }
    }),

    approveLeave: makeTool({
      description: "Approve a pending leave request.",
      parameters: z.object({
        requestId: z.string().describe("The ID of the leave request to approve.")
      }) as any,
      execute: async ({ requestId }: any) => {
        if (!canManageHr(context) && !context.permissions.includes("manage:leave")) {
          return { error: "Access Denied: You do not have permission to approve leave requests." };
        }
        await prisma.leaveRequest.update({
          where: { id: requestId },
          data: { status: "APPROVED", decidedAt: new Date(), decisionNote: `Approved via Lana AI by ${context.userId}` }
        });
        return { success: true, message: `Approved leave request #${requestId}.` };
      }
    }),

    rejectLeave: makeTool({
      description: "Reject a pending leave request.",
      parameters: z.object({
        requestId: z.string().describe("The ID of the leave request."),
        reason: z.string().optional().describe("Rejection notes.")
      }) as any,
      execute: async ({ requestId, reason }: any) => {
        if (!canManageHr(context) && !context.permissions.includes("manage:leave")) {
          return { error: "Access Denied." };
        }
        await prisma.leaveRequest.update({
          where: { id: requestId },
          data: { status: "REJECTED", decidedAt: new Date(), decisionNote: reason || `Rejected via Lana AI by ${context.userId}` }
        });
        return { success: true, message: `Rejected leave request #${requestId}.` };
      }
    }),

    getPayroll: makeTool({
      description: "Retrieve recent salary and payslip records for an employee.",
      parameters: z.object({
        employeeId: z.string().optional()
      }) as any,
      execute: async ({ employeeId }: any) => {
        const targetId = employeeId || context.employeeId;
        if (!targetId) return { error: "Employee ID required." };
        if (!canManageHr(context) && targetId !== context.employeeId) return { error: "Access Denied." };

        const items = await prisma.payrollItem.findMany({
          where: { employeeId: targetId },
          include: { payrollRun: true },
          orderBy: { createdAt: "desc" },
          take: 6
        });

        if (!items.length) {
          const contract = await prisma.employeeContract.findFirst({ where: { employeeId: targetId, status: "ACTIVE" } });
          return {
            baseSalary: contract ? contract.salaryAmount : "Not registered",
            payslips: []
          };
        }

        return {
          count: items.length,
          payslips: items.map((p) => ({
            id: p.id,
            period: p.payrollRun?.period || p.createdAt.toLocaleDateString("ar-SA"),
            baseSalary: p.baseSalary,
            allowances: p.allowanceTotal,
            deductions: p.deductionTotal,
            netPay: p.netPay,
            status: p.payrollRun?.status || "COMPLETED"
          }))
        };
      }
    }),

    generateSalarySlip: makeTool({
      description: "Generate and retrieve the salary slip download link for a payslip item.",
      parameters: z.object({
        payrollItemId: z.string()
      }) as any,
      execute: async ({ payrollItemId }: any) => {
        const item = await prisma.payrollItem.findUnique({ where: { id: payrollItemId }, include: { employee: true } });
        if (!item) return { error: "Payslip item not found." };
        if (!canManageHr(context) && item.employeeId !== context.employeeId) return { error: "Access Denied." };
        return {
          success: true,
          downloadUrl: `/api/employee/payslip?id=${item.id}`,
          summary: `Payslip for ${item.employee.firstName} ${item.employee.lastName} - Net Pay: ${item.netPay} SAR`
        };
      }
    }),

    searchDocuments: makeTool({
      description: "Search employee HR documents and attachments.",
      parameters: z.object({
        employeeId: z.string().optional(),
        query: z.string().optional()
      }) as any,
      execute: async ({ employeeId, query }: any) => {
        const targetId = employeeId || context.employeeId;
        if (!targetId) return { error: "Employee required." };
        if (!canManageHr(context) && targetId !== context.employeeId) return { error: "Access Denied." };

        const where: any = { employeeId: targetId };
        if (query) where.name = { contains: query, mode: "insensitive" };
        const docs = await prisma.employeeDocument.findMany({ where, take: 10, orderBy: { uploadedAt: "desc" } });
        return { count: docs.length, documents: docs.map((d) => ({ id: d.id, title: d.name, category: d.type, uploadedAt: d.uploadedAt.toLocaleDateString("ar-SA") })) };
      }
    }),

    getEmployeePermissions: makeTool({
      description: "Retrieve effective permissions, roles, and permission scopes assigned to an employee by name or ID.",
      parameters: z.object({
        employeeIdentifier: z.string().describe("Employee name, national ID, or barcode/number.")
      }) as any,
      execute: async ({ employeeIdentifier }: any) => {
        const target = employeeIdentifier || context.selectedEmployeeId || context.employeeId;
        if (!target) return { error: "يرجى تحديد اسم أو رقم الموظف للاستعلام عن صلاحياته." };
        if (!canManageHr(context) && target !== context.employeeId) return { error: "Access Denied: Insufficient permissions." };

        const emp = await prisma.employee.findFirst({
          where: {
            OR: [
              { id: target },
              { nationalId: target },
              { employeeNumber: target },
              { firstName: { contains: target, mode: "insensitive" } },
              { lastName: { contains: target, mode: "insensitive" } }
            ]
          },
          include: {
            user: { include: { roles: { include: { role: true } } } }
          }
        });
        if (!emp) return { error: `لم يتم العثور على موظف باسم أو رقم "${target}".` };
        if (!emp.user) return { error: `الموظف (${emp.firstName} ${emp.lastName}) غير مربوط بحساب مستخدم في النظام بعد.` };

        const scopes = await prisma.hrPermissionScope.findMany({ where: { userId: emp.user.id } });
        return {
          employeeName: `${emp.firstName} ${emp.lastName}`,
          employeeNumber: emp.employeeNumber,
          userId: emp.user.id,
          roles: emp.user.roles.map((r) => r.role.name),
          scopes: scopes.map((s) => ({ module: s.module, scope: s.scope, branchId: s.branchId, departmentId: s.departmentId, hospitalId: (s as any).hospitalId }))
        };
      }
    }),

    grantEmployeePermission: makeTool({
      description: "Grant or assign specific permissions, roles, or scopes (such as payroll permissions, leave permissions, or manager role) to an employee.",
      parameters: z.object({
        employeeIdentifier: z.string().describe("Employee name, national ID, or barcode/number."),
        permissionOrRole: z.string().describe("The permission, role, or module to grant (e.g. 'payroll', 'leaves', 'manage:payroll', 'HR_MANAGER')."),
        scope: z.string().optional().default("ALL").describe("Scope of permission: ALL, BRANCH, DEPARTMENT, HOSPITAL, TEAM, SELF.")
      }) as any,
      execute: async ({ employeeIdentifier, permissionOrRole, scope }: any) => {
        if (!canManageHr(context) && !context.isExecutive && !context.roles.includes("SUPER_ADMIN")) {
          return { error: "Access Denied: Only HR Managers or Executive Delegates can modify employee permissions." };
        }
        const target = employeeIdentifier || context.selectedEmployeeId;
        if (!target) return { error: "يرجى تحديد اسم أو رقم الموظف لمنحه الصلاحية." };

        const emp = await prisma.employee.findFirst({
          where: {
            OR: [
              { id: target },
              { nationalId: target },
              { employeeNumber: target },
              { firstName: { contains: target, mode: "insensitive" } },
              { lastName: { contains: target, mode: "insensitive" } }
            ]
          },
          include: { user: true }
        });
        if (!emp) return { error: `لم يتم العثور على موظف باسم أو رقم "${target}".` };
        if (!emp.user) return { error: `الموظف (${emp.firstName} ${emp.lastName}) غير مربوط بحساب مستخدم.` };

        const cleanPerm = permissionOrRole.toLowerCase();
        let moduleName = "employees";
        if (cleanPerm.includes("payroll") || cleanPerm.includes("راتب") || cleanPerm.includes("رواتب")) moduleName = "payroll";
        else if (cleanPerm.includes("leave") || cleanPerm.includes("إجاز") || cleanPerm.includes("اجاز")) moduleName = "leaves";
        else if (cleanPerm.includes("attendance") || cleanPerm.includes("حضور") || cleanPerm.includes("دوام")) moduleName = "attendance";
        else if (cleanPerm.includes("contract") || cleanPerm.includes("عقد") || cleanPerm.includes("عقود")) moduleName = "contracts";

        const { setUserScope } = await import("@/lib/permissions/engine");
        await setUserScope(emp.user.id, moduleName, scope || "ALL", null, null, null, context.userId);

        return {
          success: true,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          module: moduleName,
          scope: scope || "ALL",
          message: `تم منح الموظف (${emp.firstName} ${emp.lastName}) صلاحية الوصول وإدارة وحدة (${moduleName}) بنطاق (${scope || "ALL"}) بنجاح.`
        };
      }
    }),

    getDepartments: makeTool({
      description: "List company departments and their employee headcounts.",
      parameters: z.object({}) as any,
      execute: async () => {
        const depts = await prisma.department.findMany({
          where: { isActive: true },
          include: { _count: { select: { employees: true } } },
          orderBy: { name: "asc" }
        });
        return {
          count: depts.length,
          departments: depts.map((d) => ({ id: d.id, name: d.name, code: d.code, employeeCount: d._count.employees }))
        };
      }
    }),

    getAnnouncements: makeTool({
      description: "Retrieve active company announcements and HR circulars.",
      parameters: z.object({}) as any,
      execute: async () => {
        return {
          announcements: [
            { id: "1", title: "تحديث أوقات الدوام الرسمي في الصيف", date: "2026-07-01", priority: "HIGH" },
            { id: "2", title: "إطلاق المساعد الذكي Lana بحلته الجديدة", date: "2026-07-16", priority: "NORMAL" }
          ]
        };
      }
    }),

    getCompanyPolicies: makeTool({
      description: "Lookup standard company HR policies regarding leave, attendance, overtime, loans, or conduct.",
      parameters: z.object({
        topic: z.enum(["leave", "attendance", "overtime", "loans", "general"])
      }) as any,
      execute: async ({ topic }: any) => {
        const policies: Record<string, string> = {
          leave: "تستحق الإجازة السنوية بمعدل 30 يوماً بعد إتمام سنة عمل كاملة. تقدم طلبات الإجازة عبر بوابة الموظف قبل 7 أيام على الأقل، وتخضع لموافقة المشرف ومدير الإدارة ثم الموارد البشرية.",
          attendance: "يبدأ الدوام الرسمي في تمام الساعة 8:00 صباحاً وينتهي 4:00 مساءً. يتم تسجيل الحضور عبر بصمة الوجه/الجهاز أو البصمة الجغرافية داخل نطاق العمل المسموح.",
          overtime: "يتطلب العمل الإضافي تكليفاً مسبقاً من مدير الإدارة وموافقة الموارد البشرية. يتم احتساب ساعة العمل الإضافية في الأيام العادية بساعة ونصف وفي العطلات بساعتين.",
          loans: "يمكن للموظف الذي أتم فترة التجربة طلب سلفة مالية بحد أقصى راتب شهرين على أن تسدد على أقساط شهرية ميسرة لا تتجاوز 25% من الراتب.",
          general: "يلتزم جميع الموظفين بلائحة السلوك المهني والمحافظة على سرية بيانات العملاء والمؤسسة واستخدام الممتلكات والأنظمة للأغراض الوظيفية حصراً."
        };
        return { topic, policyContent: policies[topic] || policies.general };
      }
    }),

    analyzeFileContent: makeTool({
      description: "Analyze uploaded PDF, Excel, Word, or text file data when the user shares document text or table rows.",
      parameters: z.object({
        fileName: z.string(),
        contentOrSummary: z.string().describe("Extracted text or summary of the uploaded document or table.")
      }) as any,
      execute: async ({ fileName, contentOrSummary }: any) => {
        return {
          analyzedFile: fileName,
          extractedInsights: `Successfully analyzed ${fileName}. Summary: ${contentOrSummary.slice(0, 500)}...`,
          recommendation: "Ready to perform actions or answer specific questions based on this file data."
        };
      }
    })
  };
}
