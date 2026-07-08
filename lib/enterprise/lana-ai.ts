import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { applyScopedWhere, getAccessProfile } from "@/lib/enterprise/hierarchy";
import { listHospitals } from "@/lib/enterprise/hospitals";

export type LanaAiAnswer = {
  answer: string;
  suggestions: string[];
  results?: Array<Record<string, unknown>>;
};

function can(permissions: string[] | undefined, action: string, resource: string) {
  return hasPermission(permissions, { action, resource });
}

function isArabic(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

function normalize(text: string) {
  return text.trim().toLowerCase();
}

function policyAnswer(message: string, ar: boolean) {
  const text = normalize(message);
  if (/leave|إجاز|اجاز/.test(text)) return ar
    ? "سياسات الإجازات تُدار من وحدة الإجازات. يمكنك تقديم طلب إجازة ومتابعة حالة الاعتماد حسب التسلسل الإداري: المشرف ثم مدير الفرع ثم مدير الإدارة ثم الموارد البشرية."
    : "Leave policies are managed from the Leave module. You can submit a leave request and track approvals through supervisor, branch manager, department manager, and HR.";
  if (/salary|payroll|راتب|رواتب/.test(text)) return ar
    ? "معلومات الرواتب تظهر حسب صلاحياتك فقط. الموظف يرى راتبه، ومسؤول الرواتب أو HR يرى النطاق المصرح له."
    : "Payroll information is shown according to your permissions. Employees see their own salary, while Payroll/HR users see their authorized scope.";
  if (/contract|عقد|عقود/.test(text)) return ar
    ? "العقود محفوظة في وحدة العقود، ويمكن متابعة تاريخ البداية والنهاية والمرفقات حسب الصلاحيات."
    : "Contracts are managed in the Contracts module, including start/end dates and attachments according to permissions.";
  if (/overtime|over time|أوفر|اضافي|إضافي/.test(text)) return ar
    ? "الأوفر تايم يتطلب صلاحية manage:overtime. بعد الإرسال ينتقل للموارد البشرية، وبعد الاعتماد يدخل في كشف Excel للأوفر تايم."
    : "Overtime requires manage:overtime. Once submitted, it goes to HR; approved overtime is included in the Excel export.";
  if (/loan|سلفة|سلف/.test(text)) return ar
    ? "طلبات السلف تُرسل من مركز الطلبات وتخضع لسير الموافقات الحالي."
    : "Loan requests are submitted from the request center and follow the existing approval workflow.";
  if (/delegation|انتداب/.test(text)) return ar
    ? "طلبات الانتداب يتم ربطها بالموظف وتسير عبر نفس تسلسل الموافقات الإداري."
    : "Delegation requests are linked to the employee and follow the same administrative approval workflow.";
  return null;
}

async function answerWithOpenAi(message: string, ar: boolean): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: ar ? "أنت مساعد موارد بشرية لنظام Lana HRMS. أجب بإيجاز وبشكل عملي." : "You are an HR assistant for Lana HRMS. Answer concisely and practically." },
        { role: "user", content: message }
      ],
      temperature: 0.2
    })
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }> } | null;
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

export async function answerLanaAi({
  userId,
  roles,
  permissions,
  message
}: {
  userId: string;
  roles: string[];
  permissions: string[];
  message: string;
}): Promise<LanaAiAnswer> {
  const ar = isArabic(message);
  const lowered = normalize(message);
  const suggestions = ar
    ? ["ابحث عن موظف", "اشرح سياسة الإجازات", "حلل البيانات الناقصة", "اعرض المستشفيات"]
    : ["Search employee", "Explain leave policy", "Analyze missing data", "Show hospitals"];

  const policy = policyAnswer(message, ar);
  if (policy) return { answer: policy, suggestions };

  if (/موظف|employee|staff|عامل/.test(lowered)) {
    const profile = await getAccessProfile(userId, roles);
    const canReadEmployees = roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || can(permissions, "read", "employees");
    const where = canReadEmployees
      ? await applyScopedWhere("employees", {}, profile)
      : { userId };
    const searchTerm = message
      .replace(/ابحث|بحث|عن|الموظفين|الموظف|موظف|employees|employee|staff/gi, "")
      .trim();
    const employees = await prisma.employee.findMany({
      where: {
        AND: [
          where as any,
          searchTerm ? {
            OR: [
              { firstName: { contains: searchTerm, mode: "insensitive" } },
              { lastName: { contains: searchTerm, mode: "insensitive" } },
              { employeeNumber: { contains: searchTerm, mode: "insensitive" } },
              { nationalId: { contains: searchTerm, mode: "insensitive" } }
            ]
          } : {}
        ]
      },
      select: { id: true, employeeNumber: true, firstName: true, lastName: true, status: true, department: { select: { name: true } }, branch: { select: { name: true } } },
      take: 8
    });
    return {
      answer: ar ? `وجدت ${employees.length} موظفاً ضمن نطاق صلاحياتك.` : `Found ${employees.length} employees in your authorized scope.`,
      suggestions,
      results: employees.map((employee) => ({
        type: "employee",
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        name: `${employee.firstName} ${employee.lastName}`,
        status: employee.status,
        department: employee.department?.name,
        branch: employee.branch?.name
      }))
    };
  }

  if (/مستشفى|مستشفيات|hospital/.test(lowered)) {
    if (!roles.includes("SUPER_ADMIN") && !roles.includes("HR_MANAGER") && !can(permissions, "read", "employees")) {
      return { answer: ar ? "لا تملك صلاحية عرض المستشفيات." : "You do not have permission to view hospitals.", suggestions };
    }
    const hospitals = await listHospitals({ search: message });
    return {
      answer: ar ? `وجدت ${hospitals.hospitals.length} مستشفى ضمن البيانات المتاحة.` : `Found ${hospitals.hospitals.length} hospitals in available data.`,
      suggestions,
      results: hospitals.hospitals.slice(0, 8).map((hospital) => ({ type: "hospital", id: hospital.id, name: hospital.name, employees: hospital.employeeCount }))
    };
  }

  if (/إدارة|ادارة|department/.test(lowered)) {
    if (!roles.includes("SUPER_ADMIN") && !roles.includes("HR_MANAGER") && !can(permissions, "read", "departments")) {
      return { answer: ar ? "لا تملك صلاحية عرض الإدارات." : "You do not have permission to view departments.", suggestions };
    }
    const departments = await prisma.department.findMany({
      where: message ? { OR: [{ name: { contains: message, mode: "insensitive" } }, { code: { contains: message, mode: "insensitive" } }] } : {},
      select: { id: true, name: true, code: true, isActive: true },
      take: 8
    });
    return {
      answer: ar ? `وجدت ${departments.length} إدارة.` : `Found ${departments.length} departments.`,
      suggestions,
      results: departments.map((department) => ({ type: "department", ...department }))
    };
  }

  if (/missing|ناقص|نواقص|تحليل|analysis|analyze/.test(lowered)) {
    const canAnalyze = roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER");
    if (!canAnalyze) return { answer: ar ? "التحليلات الإدارية متاحة للموارد البشرية أو Super Admin فقط." : "Administrative analytics are available only for HR or Super Admin.", suggestions };
    const [missingEmail, missingDepartment, missingBranch, inactiveUsers, expiredDocs, expiredContracts] = await Promise.all([
      prisma.employee.count({ where: { email: null } }),
      prisma.employee.count({ where: { departmentId: null } }),
      prisma.employee.count({ where: { branchId: null } }),
      prisma.user.count({ where: { OR: [{ isActive: false }, { lastLoginAt: null }] } }),
      prisma.employeeDocument.count({ where: { expiresAt: { lt: new Date() } } }),
      prisma.employeeContract.count({ where: { endDate: { lt: new Date() } } })
    ]);
    return {
      answer: ar
        ? "تحليل سريع: راجع النتائج واقترح إكمال بيانات الموظفين والمستندات المنتهية."
        : "Quick analysis: review the results and complete missing employee data and expired documents.",
      suggestions,
      results: [
        { metric: "missingEmail", value: missingEmail },
        { metric: "missingDepartment", value: missingDepartment },
        { metric: "missingBranch", value: missingBranch },
        { metric: "inactiveUsers", value: inactiveUsers },
        { metric: "expiredDocuments", value: expiredDocs },
        { metric: "expiredContracts", value: expiredContracts }
      ]
    };
  }

  const openAiAnswer = await answerWithOpenAi(message, ar).catch(() => null);
  return {
    answer: openAiAnswer || (ar
      ? "أنا Lana AI. أستطيع مساعدتك في سياسات الموارد البشرية، الطلبات، الرواتب، الإجازات، الأوفر تايم، والبحث داخل البيانات التي تملك صلاحية رؤيتها."
      : "I am Lana AI. I can help with HR policies, requests, payroll, leave, overtime, and searching data you are allowed to access."),
    suggestions
  };
}

export async function getLanaAiMonitorData() {
  const now = new Date();
  const [errors, lastErrors, inactiveUsers, missingData, expiredDocuments, expiredContracts, overtimePending, leavePending] = await Promise.all([
    prisma.auditLog.count({ where: { action: { contains: "error", mode: "insensitive" } } }).catch(() => 0),
    prisma.auditLog.findMany({ where: { action: { contains: "error", mode: "insensitive" } }, orderBy: { createdAt: "desc" }, take: 8 }).catch(() => []),
    prisma.user.count({ where: { OR: [{ isActive: false }, { lastLoginAt: null }] } }).catch(() => 0),
    prisma.employee.count({ where: { OR: [{ email: null }, { departmentId: null }, { branchId: null }, { positionId: null }] } }).catch(() => 0),
    prisma.employeeDocument.count({ where: { expiresAt: { lt: now } } }).catch(() => 0),
    prisma.employeeContract.count({ where: { endDate: { lt: now } } }).catch(() => 0),
    prisma.overtimeRequest.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }).catch(() => 0)
  ]);

  return {
    errors,
    lastErrors,
    slowQueries: 0,
    problems: errors + missingData + expiredDocuments + expiredContracts,
    missingData,
    inactiveUsers,
    notUpdatedEmployees: missingData,
    expiredDocuments,
    expiredContracts,
    expiredResidencies: expiredDocuments,
    expiredInsurance: expiredDocuments,
    expiredPassports: expiredDocuments,
    overtimePending,
    leavePending,
    suggestions: [
      "مراجعة بيانات الموظفين الناقصة وإكمال الإدارة/الفرع/المنصب.",
      "تجديد المستندات والعقود المنتهية حسب الأولوية.",
      "متابعة طلبات الإجازات والأوفر تايم المعلقة.",
      "تفعيل مراجعة دورية للموظفين غير النشطين."
    ]
  };
}
