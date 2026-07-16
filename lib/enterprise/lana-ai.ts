import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { applyScopedWhere, getAccessProfile, resolveRoleEmployeeIds } from "@/lib/enterprise/hierarchy";
import { listHospitals } from "@/lib/enterprise/hospitals";
import { getEffectivePermissionsForRoles } from "@/lib/enterprise/permissions";
import { getEmployeeFieldAccess, redactHiddenFields } from "@/lib/enterprise/employee-field-access";

export type LanaAiAnswer = {
  answer: string;
  suggestions: string[];
  results?: Array<Record<string, unknown>>;
  // Populated only when a response exposed sensitive fields (national ID,
  // photo, contact info) for a specific employee -- lets the API route audit
  // log WHICH fields were exposed and to WHOM without ever writing the actual
  // sensitive values into AuditLog.
  sensitiveAccess?: { employeeIds: string[]; fields: string[] };
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

  // These permission-query intents must be checked BEFORE policyAnswer():
  // policyAnswer's loose keyword matching (e.g. /leave|إجاز/, /payroll|رواتب/)
  // would otherwise swallow a specific question like "من يملك صلاحية
  // الموافقة على إجازات..." or "هل الموظف X يملك صلاحية رؤية الرواتب"
  // and answer with the generic policy blurb instead.
  const WHO_CAN_APPROVE_PATTERN = /من\s+(يملك|لديه|تملك|لديها)?\s*صلاحية\s*الموافقة|من\s+يستطيع\s+الموافقة|من\s+(يوافق|يعتمد)\s+على|who\s+can\s+approve/i;
  const HAS_PERMISSION_PATTERN = /(يملك|تملك|لديه|لديها)\s*صلاحية|does\s+.*\s+have\s+permission|has\s+permission\s+to/i;
  const canQueryPermissions = roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || can(permissions, "read", "permissions");

  if (!WHO_CAN_APPROVE_PATTERN.test(message) && !HAS_PERMISSION_PATTERN.test(message)) {
    const policy = policyAnswer(message, ar);
    if (policy) return { answer: policy, suggestions };
  }

  if (WHO_CAN_APPROVE_PATTERN.test(message)) {
    if (!canQueryPermissions) {
      return { answer: ar ? "لا تملك صلاحية الاطلاع على من يملك صلاحيات الموافقة." : "You do not have permission to view who can approve requests.", suggestions };
    }

    const moduleKeywordMap: Array<[RegExp, string]> = [
      [/إجاز|leave/i, "leave"],
      [/أوفر|overtime|اضافي|إضافي/i, "overtime"],
      [/سلف|loan/i, "loan"],
      [/مصروف|expense/i, "expense"]
    ];
    const matchedModule = moduleKeywordMap.find(([pattern]) => pattern.test(message))?.[1];
    if (!matchedModule) {
      return { answer: ar ? "يرجى تحديد نوع الطلب (إجازات، أوفر تايم، سلف، مصروفات) لمعرفة المعتمدين." : "Please specify the request type (leave, overtime, loan, expense) to find approvers.", suggestions };
    }

    const [hospitals, branches] = await Promise.all([
      prisma.hospital.findMany({ select: { id: true, name: true }, take: 200 }),
      prisma.branch.findMany({ select: { id: true, name: true }, take: 200 })
    ]);
    const matchedHospital = hospitals.find((h) => message.includes(h.name));
    const matchedBranch = branches.find((b) => message.includes(b.name));

    const configured = await prisma.hrApprovalChain.findMany({ where: { module: matchedModule, isActive: true }, orderBy: { level: "asc" } });
    const levels = Array.from(new Set(configured.map((row) => row.level))).sort((a, b) => a - b);
    const resolvedRows = levels
      .map((level) => {
        const atLevel = configured.filter((row) => row.level === level);
        return (
          (matchedHospital && atLevel.find((row) => row.scopeType === "HOSPITAL" && row.scopeId === matchedHospital.id)) ||
          (matchedBranch && atLevel.find((row) => row.scopeType === "BRANCH" && row.scopeId === matchedBranch.id)) ||
          atLevel.find((row) => row.scopeType === "GLOBAL" || !row.scopeType)
        );
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row) && (row!.capabilities ?? []).includes("APPROVE"));

    const approverNames: string[] = [];
    for (const row of resolvedRows) {
      if (row.approverUserId) {
        const employee = await prisma.employee.findFirst({ where: { userId: row.approverUserId }, select: { firstName: true, lastName: true } });
        if (employee) approverNames.push(`${employee.firstName} ${employee.lastName}`);
        continue;
      }
      if (row.approverRole === "HR_MANAGER" || row.approverRole === "SUPER_ADMIN") {
        const managers = await resolveRoleEmployeeIds([row.approverRole]);
        const names = await prisma.employee.findMany({ where: { id: { in: managers.map((m) => m.id) } }, select: { firstName: true, lastName: true } });
        approverNames.push(...names.map((n) => `${n.firstName} ${n.lastName}`));
      } else if (row.approverRole === "BRANCH_MANAGER" && matchedBranch) {
        const managers = await resolveRoleEmployeeIds(["BRANCH_MANAGER"], { branchId: matchedBranch.id });
        const names = await prisma.employee.findMany({ where: { id: { in: managers.map((m) => m.id) } }, select: { firstName: true, lastName: true } });
        approverNames.push(...names.map((n) => `${n.firstName} ${n.lastName}`));
      } else if (row.approverRole === "DIRECT_MANAGER" || row.approverRole === "DEPARTMENT_MANAGER") {
        approverNames.push(ar ? `(يعتمد على ${row.approverRole === "DIRECT_MANAGER" ? "المدير المباشر" : "مدير الإدارة"} لكل موظف)` : `(depends on each employee's ${row.approverRole === "DIRECT_MANAGER" ? "direct manager" : "department manager"})`);
      }
    }

    if (!configured.length) {
      return {
        answer: ar
          ? `لا توجد سلسلة موافقات مخصصة لهذا النوع من الطلبات؛ يتم استخدام التسلسل الافتراضي (المدير المباشر ثم مدير الفرع/الإدارة ثم الموارد البشرية).`
          : "No custom approval chain is configured for this request type; the default hierarchy (direct manager, then branch/department manager, then HR) applies.",
        suggestions
      };
    }
    const scopeLabel = matchedHospital ? ` لمستشفى ${matchedHospital.name}` : matchedBranch ? ` لفرع ${matchedBranch.name}` : "";
    return {
      answer: approverNames.length
        ? (ar ? `الأشخاص الذين يملكون صلاحية الموافقة${scopeLabel}: ${approverNames.join("، ")}.` : `Approvers${scopeLabel}: ${approverNames.join(", ")}.`)
        : (ar ? "لم يتم العثور على معتمدين محددين ضمن سلسلة الموافقات المُعدة." : "No specific approvers found in the configured approval chain."),
      suggestions
    };
  }

  if (HAS_PERMISSION_PATTERN.test(message)) {
    if (!canQueryPermissions) {
      return { answer: ar ? "لا تملك صلاحية الاطلاع على صلاحيات الموظفين الآخرين." : "You do not have permission to view other employees' permissions.", suggestions };
    }

    const resourceKeywordMap: Array<[RegExp, string, string]> = [
      [/راتب|رواتب|payroll|salary/i, "payroll", "الرواتب"],
      [/إجاز|leave/i, "leave", "الإجازات"],
      [/حضور|attendance/i, "attendance", "الحضور"],
      [/تقارير|report/i, "reports", "التقارير"],
      [/عقود|contract/i, "contracts", "العقود"],
      [/مستندات|document/i, "documents", "المستندات"],
      [/سلف|loan/i, "loans", "السلف"],
      [/أوفر|overtime/i, "overtime", "الأوفر تايم"],
      [/إعدادات|settings/i, "settings", "الإعدادات"],
      [/صلاحيات|permissions/i, "permissions", "الصلاحيات"]
    ];
    const matchedResource = resourceKeywordMap.find(([pattern]) => pattern.test(message));
    const [, resourceKey, resourceLabel] = matchedResource ?? [null, "payroll", "الرواتب"];

    // Include the "ال" (definite article) prefixed form of every resource
    // stem too -- otherwise stripping "رواتب" out of "الرواتب" leaves a
    // stray "ال" behind that pollutes the employee-name search term below.
    const resourceKeywordPattern = new RegExp(
      resourceKeywordMap.flatMap(([pattern]) => [pattern.source, `ال(?:${pattern.source})`]).join("|"),
      "gi"
    );
    const nameHint = message
      .replace(/هل|الموظف|موظف|يملك|تملك|لديه|لديها|صلاحية|رؤية|عرض|does|have|permission|to|view|see/gi, "")
      .replace(resourceKeywordPattern, "")
      .replace(/[؟?.,]/g, "")
      .trim();

    const profile = await getAccessProfile(userId, roles);
    const where = await applyScopedWhere("employees", {}, profile);
    const matches = await prisma.employee.findMany({
      where: {
        AND: [
          where as any,
          nameHint ? { OR: [{ firstName: { contains: nameHint, mode: "insensitive" } }, { lastName: { contains: nameHint, mode: "insensitive" } }, { employeeNumber: { contains: nameHint, mode: "insensitive" } }] } : {}
        ]
      },
      select: { id: true, firstName: true, lastName: true, userId: true },
      take: 2
    });

    if (matches.length !== 1 || !matches[0].userId) {
      return {
        answer: matches.length > 1
          ? (ar ? "وجدت أكثر من موظف مطابق، يرجى تحديد الاسم أو الكود بدقة أكبر." : "More than one matching employee found -- please narrow down the name or employee number.")
          : (ar ? "لم أجد موظفاً مطابقاً ضمن نطاق صلاحياتك." : "No matching employee found within your authorized scope."),
        suggestions
      };
    }

    const target = matches[0];
    const targetRoleRows = await prisma.userRole.findMany({ where: { userId: target.userId! }, select: { role: { select: { name: true } } } });
    const targetRoles = targetRoleRows.map((row) => row.role.name);
    const effectivePermissions = await getEffectivePermissionsForRoles(targetRoles, target.userId!);
    const hasView = hasPermission(effectivePermissions, { action: "read", resource: resourceKey }, targetRoles);

    return {
      answer: ar
        ? `${target.firstName} ${target.lastName} ${hasView ? "يملك" : "لا يملك"} صلاحية عرض ${resourceLabel}.`
        : `${target.firstName} ${target.lastName} ${hasView ? "does" : "does not"} have permission to view ${resourceLabel}.`,
      suggestions
    };
  }

  if (/موظف|employee|staff|عامل/.test(lowered)) {
    const profile = await getAccessProfile(userId, roles);
    // canReadEmployees mirrors the same SUPER_ADMIN/HR_MANAGER/permission gate
    // used everywhere else in the app; applyScopedWhere then still narrows
    // even these roles down to whatever hierarchy scope they're entitled to
    // (SUPER_ADMIN/HR_MANAGER get the unrestricted baseWhere -- everyone else
    // stays scoped to their branch/department). Non-privileged callers never
    // get past `{ userId }`, so no query below can ever resolve to a row that
    // isn't the caller's own, regardless of which fields are selected.
    const canReadEmployees = roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || can(permissions, "read", "employees");
    const where = canReadEmployees
      ? await applyScopedWhere("employees", {}, profile)
      : { userId };
    // Strips both the generic "search employee" filler words AND the detail/
    // photo request words (with common Arabic verb/pronoun/conjunction forms)
    // so a natural request like "جيب لي بيانات الموظف أحمد وصورته" reduces
    // cleanly down to just the name/code being asked about.
    const FILLER_PATTERN = new RegExp([
      "ابحث", "بحث", "عن", "الموظفين", "الموظف", "موظف", "employees", "employee", "staff",
      "جيب", "لي", "اعطني", "أعطني", "اعطيني", "أعطيني", "هات", "احضر", "ورني", "أرني", "ارني",
      "وبياناته", "وبياناتها", "وبياناتي", "وبيانات", "بياناته", "بياناتها", "بياناتي", "بيانات",
      "وملفه", "وملفها", "وملفي", "وملف", "ملفه", "ملفها", "ملفي", "ملف",
      "وصورته", "وصورتها", "وصورتي", "وصورة", "صورته", "صورتها", "صورتي", "صورة",
      "وهويته", "وهويتها", "وهويتي", "وهوية", "هويته", "هويتها", "هويتي", "هوية",
      "رقم\\s*الهوية",
      "وتفاصيله", "وتفاصيلها", "وتفاصيلي", "وتفاصيل", "تفاصيله", "تفاصيلها", "تفاصيلي", "تفاصيل",
      "profile", "photo", "picture", "details", "full\\s*info", "info",
      "\\bو\\b"
    ].join("|"), "gi");
    const searchTerm = message.replace(FILLER_PATTERN, "").replace(/\s+/g, " ").trim();
    const searchWords = searchTerm.split(" ").filter(Boolean);
    // Two-word names (common for "First Last") don't match a single `contains`
    // against one field, since firstName/lastName are stored separately --
    // try both orderings in addition to the whole-string match below.
    const nameOrderConditions = searchWords.length >= 2 ? [
      { AND: [{ firstName: { contains: searchWords[0], mode: "insensitive" } }, { lastName: { contains: searchWords.slice(1).join(" "), mode: "insensitive" } }] },
      { AND: [{ lastName: { contains: searchWords[0], mode: "insensitive" } }, { firstName: { contains: searchWords.slice(1).join(" "), mode: "insensitive" } }] }
    ] : [];
    const searchWhere = {
      AND: [
        where as any,
        searchTerm ? {
          OR: [
            { firstName: { contains: searchTerm, mode: "insensitive" } },
            { lastName: { contains: searchTerm, mode: "insensitive" } },
            { employeeNumber: { contains: searchTerm, mode: "insensitive" } },
            { nationalId: { contains: searchTerm, mode: "insensitive" } },
            ...nameOrderConditions
          ]
        } : {}
      ]
    };

    // "Give me employee X's data/photo/national id" -- only kicks in when the
    // search term narrows to exactly ONE employee within the caller's scope.
    // Ambiguous or empty matches fall through to the plain list below rather
    // than guessing which employee was meant.
    const wantsDetail = /بيانات|ملف|صورة|هوية|رقم\s*الهوية|تفاصيل|صورته|صورتي|profile|photo|picture|details|full\s*info/i.test(lowered);
    if (wantsDetail && searchTerm) {
      const matches = await prisma.employee.findMany({
        where: searchWhere,
        select: {
          id: true, employeeNumber: true, nationalId: true, firstName: true, lastName: true,
          email: true, phone: true, profilePhotoUrl: true, status: true, hireDate: true,
          department: { select: { name: true } }, branch: { select: { name: true } }, position: { select: { title: true } },
          manager: { select: { firstName: true, lastName: true } },
          documents: { select: { name: true, type: true, status: true, expiresAt: true }, orderBy: { uploadedAt: "desc" }, take: 5 }
        },
        take: 2
      });
      if (matches.length === 1) {
        const employee = matches[0];
        // Field-level access is per VIEWER (the caller), not per target --
        // an admin can restrict what a specific staff member sees whenever
        // THEY look at any employee's sensitive fields through this tool.
        const fieldAccess = await getEmployeeFieldAccess(userId, roles);
        const exposedFields = (["nationalId", "email", "phone", "profilePhotoUrl"] as const).filter((field) => fieldAccess[field] !== "HIDDEN");
        return {
          answer: ar
            ? `بيانات الموظف ${employee.firstName} ${employee.lastName}:`
            : `Details for ${employee.firstName} ${employee.lastName}:`,
          suggestions,
          results: [{
            type: "employee-profile",
            id: employee.id,
            employeeNumber: employee.employeeNumber,
            nationalId: fieldAccess.nationalId === "HIDDEN" ? undefined : employee.nationalId,
            name: `${employee.firstName} ${employee.lastName}`,
            email: fieldAccess.email === "HIDDEN" ? undefined : employee.email,
            phone: fieldAccess.phone === "HIDDEN" ? undefined : employee.phone,
            photoUrl: fieldAccess.profilePhotoUrl === "HIDDEN" ? undefined : employee.profilePhotoUrl,
            status: employee.status,
            hireDate: employee.hireDate,
            department: employee.department?.name,
            branch: employee.branch?.name,
            position: employee.position?.title,
            manager: employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : undefined,
            documents: employee.documents.map((doc) => `${doc.name} (${doc.type}/${doc.status})`).join(", ") || (ar ? "لا توجد مستندات" : "No documents")
          }],
          sensitiveAccess: exposedFields.length ? { employeeIds: [employee.id], fields: exposedFields } : undefined
        };
      }
      if (matches.length > 1) {
        return {
          answer: ar ? "وجدت أكثر من موظف مطابق، يرجى تحديد الاسم أو الكود بدقة أكبر." : "More than one matching employee found -- please narrow down the name or employee number.",
          suggestions
        };
      }
      // 0 matches within scope -- fall through to the plain list message below,
      // which will also report 0 results without revealing whether the
      // employee exists outside the caller's authorized scope.
    }

    const employees = await prisma.employee.findMany({
      where: searchWhere,
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
