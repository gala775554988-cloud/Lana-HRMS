import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { applyScopedWhere, getAccessProfile, resolveRoleEmployeeIds } from "@/lib/enterprise/hierarchy";
import { listHospitals } from "@/lib/enterprise/hospitals";
import { getEffectivePermissionsForRoles } from "@/lib/enterprise/permissions";
import { getEmployeeFieldAccess, redactHiddenFields } from "@/lib/enterprise/employee-field-access";
import { isOdooIntegrationEnabled, getLanaApiKey } from "@/lib/settings";
import type { LanaSyncEntity } from "@/lib/enterprise/lana-sync-actions";
import { isLanaDelegate } from "@/lib/enterprise/lana-delegates";
import { writeAuditLog } from "@/lib/audit";
import { syncEmployeeFieldsFromOdoo, type FieldSyncMode } from "@/lib/enterprise/lana-field-sync";

export type LanaAiAnswer = {
  answer: string;
  suggestions: string[];
  results?: Array<Record<string, unknown>>;
  // Populated only when a response exposed sensitive fields (national ID,
  // photo, contact info) for a specific employee -- lets the API route audit
  // log WHICH fields were exposed and to WHOM without ever writing the actual
  // sensitive values into AuditLog.
  sensitiveAccess?: { employeeIds: string[]; fields: string[] };
  // Set when this reply promised to run a real background job (Odoo sync /
  // document crawl). The API route runs it via Next.js after() so it keeps
  // executing once this response has already been sent, and posts a
  // completion notification with the real result when it's done.
  backgroundSync?: { userId: string; entity: LanaSyncEntity };
  // Set for a group field-sync command: the API route runs runGroupFieldSync
  // via after() and the detailed table report lands as a notification once
  // the whole group has been processed.
  backgroundFieldSync?: { userId: string; employeeIds: string[]; mode: FieldSyncMode; groupLabel: string; ar: boolean };
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
  const apiKey = await getLanaApiKey();
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

  // "Executive" command: assign a specific employee as the responsible
  // approver for a hospital/branch. Also checked before policyAnswer() --
  // otherwise a command naming "إجازات"/"رواتب" etc. would be swallowed by
  // the generic policy blurb. Deliberately a narrow, hardcoded pattern (not
  // a general-purpose command interpreter): gated to explicitly
  // admin-designated delegates, never guesses on name ambiguity, and always
  // confirms against freshly re-read DB state after writing.
  const ASSIGN_RESPONSIBLE_PATTERN = /اجعل[ي]?\s+(?:ال)?موظف(?:ة)?\s+(.+?)\s+مسؤول(?:ة|اً|ا)?\s+عن\s+(مستشفى|فرع)\s+(.+?)(?:\s+ل(?:موافقات|طلبات)\s+(.+?))?[.؟?]?\s*$/u;
  const assignMatch = ASSIGN_RESPONSIBLE_PATTERN.exec(message.trim());
  if (assignMatch) {
    return handleAssignResponsibleCommand({ userId, roles, ar, suggestions, match: assignMatch });
  }

  // Field-level Odoo re-sync commands ("حدث كود/بيانات/الراتب/المستشفى/
  // الحساب التحليلي الموظف X من أودو" and the "مجموعة الموظفين ... في
  // مستشفى Y" group variant). Group pattern checked first since "الموظفين"
  // (no space right after the "موظف" stem) never overlaps with the single
  // pattern's "موظف\s+" requirement, but checking group first removes any
  // doubt. Also placed before policyAnswer() for the same reason as above.
  const FIELD_SYNC_GROUP_PATTERN = /حدث\s+(كود|بيانات|الراتب|المستشفى|الحساب\s*التحليلي)?\s*(?:مجموعة\s+الموظفين|الموظفين)(?:\s+الموجودين)?\s+في\s+مستشفى\s+(.+?)\s+من\s+أودو/u;
  const FIELD_SYNC_SINGLE_PATTERN = /حدث\s+(كود|بيانات|الراتب|المستشفى|الحساب\s*التحليلي)?\s*(?:ال)?موظف\s+(.+?)\s+من\s+أودو/u;
  const groupSyncMatch = FIELD_SYNC_GROUP_PATTERN.exec(message.trim());
  if (groupSyncMatch) {
    return handleFieldSyncGroupCommand({ userId, roles, ar, suggestions, match: groupSyncMatch });
  }
  const singleSyncMatch = FIELD_SYNC_SINGLE_PATTERN.exec(message.trim());
  if (singleSyncMatch) {
    return handleFieldSyncSingleCommand({ userId, roles, ar, suggestions, match: singleSyncMatch });
  }

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

  // Checked before the generic employee-search branch below (which would
  // otherwise swallow "زامني بيانات الموظفين" / "سحب مستندات الموظفين" etc.
  // since they also mention "موظف").
  const SYNC_EMPLOYEES_PATTERN = /زامن|مزامن|اسحب.{0,20}بيانات.{0,20}موظف|شغل.{0,10}مزامنة|sync\s+employees?|run\s+sync/i;
  const SYNC_DOCUMENTS_PATTERN = /أرشيف\s*المستندات|أرشفة\s*المستندات|(سحب|حدث).{0,10}(مستندات|مرفقات)|مسح.{0,10}مرفقات|crawl.{0,10}document|sync.{0,10}document/i;
  if (SYNC_EMPLOYEES_PATTERN.test(message) || SYNC_DOCUMENTS_PATTERN.test(message)) {
    const canTrigger = roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER");
    if (!canTrigger) {
      return { answer: ar ? "لا تملك صلاحية تشغيل مزامنة Odoo." : "You do not have permission to trigger an Odoo sync.", suggestions };
    }
    if (!(await isOdooIntegrationEnabled())) {
      return { answer: ar ? "تكامل Odoo غير مُفعّل حالياً من الإعدادات." : "Odoo integration is currently disabled in settings.", suggestions };
    }

    const wantsDocuments = SYNC_DOCUMENTS_PATTERN.test(message);
    const entity: LanaSyncEntity = wantsDocuments ? "documents" : "employees";
    const jobLabel = wantsDocuments ? "أرشفة المستندات" : "مزامنة بيانات الموظفين (والمستشفيات عبر ربط الأقسام)";
    return {
      answer: ar
        ? `بدأت الآن عملية ${jobLabel}. هذه العملية قد تستغرق عدة دقائق لعدد كبير من الموظفين -- سأرسل لك إشعاراً بالنتيجة والعدد الإجمالي فور الانتهاء.`
        : `Started ${jobLabel} now. This can take several minutes for a large employee count -- I'll notify you with the result and total count once it's done.`,
      suggestions,
      backgroundSync: { userId, entity }
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

const MODULE_KEYWORD_MAP: Array<[RegExp, string, string]> = [
  [/إجاز/i, "leave", "الإجازات"],
  [/أوفر|اضافي|إضافي/i, "overtime", "الأوفر تايم"],
  [/سلف/i, "loan", "السلف"],
  [/مصروف/i, "expense", "المصروفات"]
];
const ALL_APPROVAL_MODULES: Array<[string, string]> = [["leave", "الإجازات"], ["overtime", "الأوفر تايم"], ["loan", "السلف"], ["expense", "المصروفات"]];

/**
 * Executive command handler: "اجعل الموظف X مسؤولاً عن مستشفى/فرع Y [لموافقات Z]".
 * Hardcoded, narrow logic per the explicit spec -- not a general interpreter:
 *   1. Delegate check first, before touching any data.
 *   2. Any name ambiguity (scope or employee) stops immediately with a
 *      disambiguation list -- nothing is written until the caller repeats
 *      the command with an unambiguous identifier (employee number).
 *   3. After writing, the affected HrApprovalChain rows are re-read fresh
 *      from the DB (not just the values just sent) for the confirmation
 *      report, and everything is audit-logged.
 */
async function handleAssignResponsibleCommand({
  userId,
  roles,
  ar,
  suggestions,
  match
}: {
  userId: string;
  roles: string[];
  ar: boolean;
  suggestions: string[];
  match: RegExpExecArray;
}): Promise<LanaAiAnswer> {
  if (!(await isLanaDelegate(userId, roles))) {
    return {
      answer: ar
        ? "هذا أمر تنفيذي (تعديل سلسلة الموافقات) متاح فقط للمفوَّضين الذين حددهم المسؤول في لوحة التحكم. لا تملك هذه الصلاحية حالياً."
        : "This is an executive command (editing the approval chain) available only to delegates the admin has designated. You don't currently have this permission.",
      suggestions
    };
  }

  const [, employeeToken, scopeKeyword, scopeToken, moduleToken] = match;
  const scopeType: "HOSPITAL" | "BRANCH" = scopeKeyword.trim() === "مستشفى" ? "HOSPITAL" : "BRANCH";

  // --- Resolve scope (hospital/branch) — stop on 0 or >1 matches ---
  const scopeName = scopeToken.trim();
  const scopeCandidates = scopeType === "HOSPITAL"
    ? await prisma.hospital.findMany({ where: { name: { contains: scopeName, mode: "insensitive" } }, select: { id: true, name: true }, take: 10 })
    : await prisma.branch.findMany({ where: { name: { contains: scopeName, mode: "insensitive" } }, select: { id: true, name: true }, take: 10 });

  if (scopeCandidates.length === 0) {
    const label = scopeType === "HOSPITAL" ? "مستشفى" : "فرعاً";
    return { answer: ar ? `لم أجد ${label} باسم "${scopeName}". لم يتم تنفيذ أي تغيير.` : `No matching ${scopeType.toLowerCase()} found for "${scopeName}". Nothing was executed.`, suggestions };
  }
  if (scopeCandidates.length > 1) {
    return {
      answer: ar
        ? `وجدت أكثر من ${scopeType === "HOSPITAL" ? "مستشفى" : "فرع"} مطابق لـ "${scopeName}". يرجى إعادة الأمر باستخدام الاسم الدقيق: ${scopeCandidates.map((c) => c.name).join("، ")}. لم يتم تنفيذ أي تغيير.`
        : `More than one matching ${scopeType.toLowerCase()} found for "${scopeName}": ${scopeCandidates.map((c) => c.name).join(", ")}. Please repeat the command with the exact name. Nothing was executed.`,
      suggestions
    };
  }
  const scope = scopeCandidates[0];

  // --- Resolve employee — stop on 0 or >1 matches, with a disambiguation
  // list showing employee number/title/department (per the explicit spec) ---
  const employeeName = employeeToken.trim();
  const employeeCandidates = await prisma.employee.findMany({
    where: {
      OR: [
        { employeeNumber: { equals: employeeName, mode: "insensitive" } },
        { firstName: { contains: employeeName, mode: "insensitive" } },
        { lastName: { contains: employeeName, mode: "insensitive" } }
      ]
    },
    select: { id: true, employeeNumber: true, firstName: true, lastName: true, userId: true, position: { select: { title: true } }, department: { select: { name: true } } },
    take: 10
  });

  if (employeeCandidates.length === 0) {
    return { answer: ar ? `لم أجد موظفاً باسم أو رقم "${employeeName}". لم يتم تنفيذ أي تغيير.` : `No matching employee found for "${employeeName}". Nothing was executed.`, suggestions };
  }
  if (employeeCandidates.length > 1) {
    const options = employeeCandidates
      .map((employee) => `${employee.employeeNumber} - ${employee.firstName} ${employee.lastName} (${employee.position?.title ?? "-"} / ${employee.department?.name ?? "-"})`)
      .join("\n");
    return {
      answer: ar
        ? `وجدت أكثر من موظف مطابق لـ "${employeeName}":\n${options}\n\nيرجى إعادة الأمر باستخدام رقم الموظف الدقيق (مثال: "اجعل الموظف ${employeeCandidates[0].employeeNumber} مسؤولاً عن ${scopeKeyword} ${scope.name}"). لم يتم تنفيذ أي تغيير.`
        : `More than one matching employee found for "${employeeName}":\n${options}\n\nPlease repeat the command with the exact employee number. Nothing was executed.`,
      suggestions
    };
  }
  const employee = employeeCandidates[0];
  if (!employee.userId) {
    return {
      answer: ar
        ? `الموظف ${employee.firstName} ${employee.lastName} (${employee.employeeNumber}) لا يملك حساب مستخدم مرتبطاً، ولا يمكن تعيينه معتمداً. لم يتم تنفيذ أي تغيير.`
        : `${employee.firstName} ${employee.lastName} (${employee.employeeNumber}) has no linked user account and can't be assigned as an approver. Nothing was executed.`,
      suggestions
    };
  }

  // --- Resolve module(s): a named type, or all four if none was specified ---
  const matchedModule = moduleToken ? MODULE_KEYWORD_MAP.find(([pattern]) => pattern.test(moduleToken)) : null;
  const targetModules: Array<[string, string]> = matchedModule ? [[matchedModule[1], matchedModule[2]]] : ALL_APPROVAL_MODULES;

  // --- Execute: upsert a level-1 scoped override per target module ---
  const before: Record<string, unknown> = {};
  for (const [moduleKey] of targetModules) {
    before[moduleKey] = await prisma.hrApprovalChain.findUnique({
      where: { module_level_scopeType_scopeId: { module: moduleKey, level: 1, scopeType, scopeId: scope.id } }
    });
  }

  for (const [moduleKey] of targetModules) {
    await prisma.hrApprovalChain.upsert({
      where: { module_level_scopeType_scopeId: { module: moduleKey, level: 1, scopeType, scopeId: scope.id } },
      update: { approverUserId: employee.userId, approverRole: "DIRECT_MANAGER", capabilities: ["VIEW", "APPROVE", "REJECT"], isActive: true },
      create: { module: moduleKey, level: 1, scopeType, scopeId: scope.id, approverUserId: employee.userId, approverRole: "DIRECT_MANAGER", capabilities: ["VIEW", "APPROVE", "REJECT"], isActive: true }
    });
  }

  // --- Validation: re-read the freshly-written state from the DB (never
  // trust the values just sent) to build the confirmation report ---
  const afterRows = await prisma.hrApprovalChain.findMany({
    where: { scopeType, scopeId: scope.id, module: { in: targetModules.map(([key]) => key) } },
    orderBy: { module: "asc" }
  });

  await writeAuditLog({
    actorUserId: userId,
    action: "lana-ai:assign-approver",
    entity: "hrApprovalChain",
    metadata: { before, after: afterRows, employeeId: employee.id, scopeType, scopeId: scope.id, scopeName: scope.name }
  });

  const scopeLabel = scopeType === "HOSPITAL" ? "مستشفى" : "فرع";
  const employeeLabel = `${employee.firstName} ${employee.lastName} (${employee.employeeNumber})`;
  const lines = afterRows.map((row) => {
    const moduleLabel = ALL_APPROVAL_MODULES.find(([key]) => key === row.module)?.[1] ?? row.module;
    return `${moduleLabel}: ${scopeLabel} ${scope.name} -> ${employeeLabel} (${(row.capabilities ?? []).includes("APPROVE") ? "موافقة/رفض" : "إظهار فقط"})`;
  });

  return {
    answer: ar
      ? `تم تنفيذ سلسلة الموافقات كالتالي:\n${lines.join("\n")}`
      : `Approval chain executed as follows:\n${lines.join("\n")}`,
    suggestions
  };
}

function fieldSyncModeFromDescriptor(descriptor: string | undefined): FieldSyncMode {
  return descriptor?.trim() === "كود" ? "identity" : "full";
}

/** "حدث [كود|بيانات|الراتب|المستشفى|الحساب التحليلي] الموظف X من أودو" --
 * delegate-gated, single-employee, disambiguation-first like the executive
 * assign command. Runs synchronously (one Odoo round trip) so the detailed
 * report can be returned immediately in the chat reply itself. */
async function handleFieldSyncSingleCommand({
  userId,
  roles,
  ar,
  suggestions,
  match
}: {
  userId: string;
  roles: string[];
  ar: boolean;
  suggestions: string[];
  match: RegExpExecArray;
}): Promise<LanaAiAnswer> {
  if (!(await isLanaDelegate(userId, roles))) {
    return {
      answer: ar ? "هذا أمر تنفيذي (مزامنة بيانات من أودو) متاح فقط للمفوَّضين الذين حددهم المسؤول." : "This is an executive command (syncing data from Odoo) available only to designated delegates.",
      suggestions
    };
  }
  if (!(await isOdooIntegrationEnabled())) {
    return { answer: ar ? "تكامل Odoo غير مُفعّل حالياً من الإعدادات." : "Odoo integration is currently disabled in settings.", suggestions };
  }

  const [, descriptor, employeeToken] = match;
  const mode = fieldSyncModeFromDescriptor(descriptor);
  const employeeName = employeeToken.trim();

  const candidates = await prisma.employee.findMany({
    where: {
      OR: [
        { employeeNumber: { equals: employeeName, mode: "insensitive" } },
        { firstName: { contains: employeeName, mode: "insensitive" } },
        { lastName: { contains: employeeName, mode: "insensitive" } }
      ]
    },
    select: { id: true, employeeNumber: true, firstName: true, lastName: true, position: { select: { title: true } }, department: { select: { name: true } } },
    take: 10
  });

  if (candidates.length === 0) {
    return { answer: ar ? `لم أجد موظفاً باسم أو رقم "${employeeName}". لم يتم تنفيذ أي تغيير.` : `No matching employee found for "${employeeName}". Nothing was executed.`, suggestions };
  }
  if (candidates.length > 1) {
    const options = candidates.map((employee) => `${employee.employeeNumber} - ${employee.firstName} ${employee.lastName} (${employee.position?.title ?? "-"} / ${employee.department?.name ?? "-"})`).join("\n");
    return {
      answer: ar
        ? `وجدت أكثر من موظف مطابق لـ "${employeeName}":\n${options}\n\nيرجى إعادة الأمر باستخدام رقم الموظف الدقيق. لم يتم تنفيذ أي تغيير.`
        : `More than one matching employee found for "${employeeName}":\n${options}\n\nPlease repeat the command with the exact employee number. Nothing was executed.`,
      suggestions
    };
  }

  const result = await syncEmployeeFieldsFromOdoo(candidates[0].id, mode, ar);
  await writeAuditLog({
    actorUserId: userId,
    action: "lana-ai:field-sync-single",
    entity: "employee",
    entityId: candidates[0].id,
    metadata: { mode, result }
  });

  if (!result.success) {
    return {
      answer: ar
        ? `العملية: تحديث بيانات\nالنتيجة: فشل التحديث\nالتفاصيل: ${result.label} -- ${result.reason}`
        : `Operation: update data\nResult: failed\nDetails: ${result.label} -- ${result.reason}`,
      suggestions
    };
  }
  return {
    answer: ar
      ? `العملية: تحديث بيانات\nالنتيجة: تم التحديث بنجاح\nالتفاصيل: ${result.changes.length ? result.changes.join("، ") : "لا يوجد تغيير (البيانات مطابقة بالفعل)"}`
      : `Operation: update data\nResult: success\nDetails: ${result.changes.length ? result.changes.join(", ") : "no change (already matched)"}`,
    suggestions
  };
}

/** Group variant: "حدث ... مجموعة الموظفين الموجودين في مستشفى Y من أودو".
 * Same delegate gate and hospital-name disambiguation, but since this can
 * touch many employees (each a real Odoo round trip), it acknowledges
 * immediately and the actual run + detailed table report happens via
 * backgroundFieldSync (executed by the API route through Next.js after()). */
async function handleFieldSyncGroupCommand({
  userId,
  roles,
  ar,
  suggestions,
  match
}: {
  userId: string;
  roles: string[];
  ar: boolean;
  suggestions: string[];
  match: RegExpExecArray;
}): Promise<LanaAiAnswer> {
  if (!(await isLanaDelegate(userId, roles))) {
    return {
      answer: ar ? "هذا أمر تنفيذي (مزامنة بيانات من أودو) متاح فقط للمفوَّضين الذين حددهم المسؤول." : "This is an executive command (syncing data from Odoo) available only to designated delegates.",
      suggestions
    };
  }
  if (!(await isOdooIntegrationEnabled())) {
    return { answer: ar ? "تكامل Odoo غير مُفعّل حالياً من الإعدادات." : "Odoo integration is currently disabled in settings.", suggestions };
  }

  const [, descriptor, hospitalToken] = match;
  const mode = fieldSyncModeFromDescriptor(descriptor);
  const hospitalName = hospitalToken.trim();

  const hospitalCandidates = await prisma.hospital.findMany({ where: { name: { contains: hospitalName, mode: "insensitive" } }, select: { id: true, name: true }, take: 10 });
  if (hospitalCandidates.length === 0) {
    return { answer: ar ? `لم أجد مستشفى باسم "${hospitalName}". لم يتم تنفيذ أي تغيير.` : `No matching hospital found for "${hospitalName}". Nothing was executed.`, suggestions };
  }
  if (hospitalCandidates.length > 1) {
    return {
      answer: ar
        ? `وجدت أكثر من مستشفى مطابق لـ "${hospitalName}": ${hospitalCandidates.map((h) => h.name).join("، ")}. يرجى إعادة الأمر باستخدام الاسم الدقيق. لم يتم تنفيذ أي تغيير.`
        : `More than one matching hospital found for "${hospitalName}": ${hospitalCandidates.map((h) => h.name).join(", ")}. Please repeat with the exact name. Nothing was executed.`,
      suggestions
    };
  }
  const hospital = hospitalCandidates[0];

  const employees = await prisma.employee.findMany({ where: { hospitalId: hospital.id }, select: { id: true }, take: 2000 });
  if (employees.length === 0) {
    return { answer: ar ? `لا يوجد موظفون مسجلون في مستشفى ${hospital.name} حالياً.` : `No employees currently recorded at ${hospital.name}.`, suggestions };
  }

  return {
    answer: ar
      ? `بدأت الآن مزامنة بيانات ${employees.length} موظفاً من مستشفى ${hospital.name} مع أودو. سأرسل لك تقريراً مفصلاً (جدول النتائج والمتعثرين) فور الانتهاء.`
      : `Started syncing ${employees.length} employees from ${hospital.name} with Odoo now. I'll send a detailed report (results table + stragglers) once it's done.`,
    suggestions,
    backgroundFieldSync: { userId, employeeIds: employees.map((e) => e.id), mode, groupLabel: ar ? `مستشفى ${hospital.name}` : hospital.name, ar }
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
