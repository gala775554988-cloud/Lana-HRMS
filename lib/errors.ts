/**
 * Lana HRMS Professional Error System
 * Provides structured, detailed error information for all error types
 */


// ── Error Types ──────────────────────────────────────────────
export type ErrorCategory = "validation" | "prisma" | "api" | "database" | "auth" | "network" | "render" | "unknown";

export interface StructuredError {
  id: string;
  category: ErrorCategory;
  name: string;
  message: string;
  cause?: string;
  location?: string;
  suggestion?: string;
  statusCode?: number;
  fields?: Array<{ field: string; message: string }>;
  prismaOperation?: string;
  details?: Record<string, unknown>;
}

// ── Error Reference Generator ────────────────────────────────
export function generateErrorRef(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ERR-${timestamp}-${rand}`;
}

// ── Prisma Error Codes Map ───────────────────────────────────
const prismaErrorMap: Record<string, { name: string; cause: string; suggestion: string }> = {
  P2002: {
    name: "Unique Constraint Violation",
    cause: "محاولة إنشاء سجل بقيمة موجودة مسبقاً في حقل فريد",
    suggestion: "تحقق من القيم الفريدة (البريد الإلكتروني، رقم الموظف، رقم الهوية) وتأكد من عدم تكرارها",
  },
  P2025: {
    name: "Record Not Found",
    cause: "السجل المطلوب غير موجود في قاعدة البيانات",
    suggestion: "تأكد من صحة المعرف وأن السجل لم يتم حذفه",
  },
  P2003: {
    name: "Foreign Key Constraint Failed",
    cause: "مرجع مفتاح أجنبي غير صالح - السجل المرتبط غير موجود",
    suggestion: "تأكد من وجود السجل المرتبط قبل إنشاء العلاقة",
  },
  P2014: {
    name: "Required Relation Violation",
    cause: "علاقة مطلوبة غير متوفرة",
    suggestion: "تأكد من توفير جميع الحقول المطلوبة المرتبطة بسجلات أخرى",
  },
  P2016: {
    name: "Query Interpretation Error",
    cause: "خطأ في تفسير الاستعلام",
    suggestion: "تحقق من صحة معاملات الاستعلام",
  },
  P2019: {
    name: "Input Error",
    cause: "بيانات إدخال غير صالحة",
    suggestion: "تحقق من صحة البيانات المدخلة وتوافقها مع المتطلبات",
  },
  P2021: {
    name: "Table Does Not Exist",
    cause: "الجدول المطلوب غير موجود في قاعدة البيانات",
    suggestion: "قم بتشغيل migration لإنشاء الجداول المفقودة: npx prisma migrate deploy",
  },
  P2024: {
    name: "Connection Timeout",
    cause: "انتهت مهلة الاتصال بقاعدة البيانات",
    suggestion: "تحقق من اتصال الشبكة وحالة خادم قاعدة البيانات",
  },
};

// ── Parse Error to Structured Error ──────────────────────────
export function parseError(error: unknown, context?: { location?: string; operation?: string }): StructuredError {
  const id = generateErrorRef();

  // Prisma errors
  if (error && typeof error === "object" && "code" in error) {
    const prismaError = error as { code: string; message?: string; meta?: any };
    const mapped = prismaErrorMap[prismaError.code];
    if (mapped) {
      return {
        id,
        category: "prisma",
        name: mapped.name,
        message: `خطأ Prisma [${prismaError.code}]: ${mapped.name}`,
        cause: mapped.cause,
        location: context?.location,
        suggestion: mapped.suggestion,
        prismaOperation: context?.operation,
        details: prismaError.meta ? { meta: prismaError.meta } : undefined,
      };
    }
    return {
      id,
      category: "prisma",
      name: `Prisma Error [${prismaError.code}]`,
      message: prismaError.message || "خطأ غير معروف في قاعدة البيانات",
      cause: "حدث خطأ أثناء العملية على قاعدة البيانات",
      location: context?.location,
      suggestion: "تحقق من البيانات وحاول مرة أخرى. إذا استمر الخطأ، تواصل مع الدعم الفني",
      prismaOperation: context?.operation,
      details: prismaError.meta ? { meta: prismaError.meta } : undefined,
    };
  }

  // Zod/Validation errors
  if (error && typeof error === "object" && "issues" in error) {
    const zodError = error as { issues: Array<{ path: (string | number)[]; message: string }> };
    return {
      id,
      category: "validation",
      name: "Validation Error",
      message: "فشل التحقق من صحة البيانات",
      cause: "بعض الحقول لا تستوفي المتطلبات",
      location: context?.location,
      suggestion: "راجع الحقول المحددة أدناه وأصلح الأخطاء",
      fields: zodError.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  // Standard Error objects
  if (error instanceof Error) {
    // Auth errors
    if (error.message === "Unauthorized" || error.message.includes("not authenticated")) {
      return {
        id,
        category: "auth",
        name: "Authentication Error",
        message: "غير مصرح - يرجى تسجيل الدخول",
        cause: "الجلسة منتهية أو غير صالحة",
        location: context?.location,
        suggestion: "سجل الدخول مرة أخرى وحاول تكرار العملية",
        statusCode: 401,
      };
    }
    if (error.message === "Forbidden") {
      return {
        id,
        category: "auth",
        name: "Authorization Error",
        message: "ليس لديك صلاحية لهذا الإجراء",
        cause: "حسابك لا يملك الصلاحيات المطلوبة",
        location: context?.location,
        suggestion: "تواصل مع المسؤول لمنحك الصلاحية المناسبة",
        statusCode: 403,
      };
    }

    // Network errors
    if (error.message.includes("fetch") || error.message.includes("network") || error.message.includes("Failed to fetch")) {
      return {
        id,
        category: "network",
        name: "Network Error",
        message: "خطأ في الاتصال بالخادم",
        cause: "تعذر الوصول إلى الخادم أو انقطع الاتصال",
        location: context?.location,
        suggestion: "تحقق من اتصالك بالإنترنت وحاول مرة أخرى",
      };
    }

    // Generic error
    return {
      id,
      category: "unknown",
      name: error.name || "Error",
      message: error.message,
      cause: error.cause?.toString() || "حدث خطأ غير متوقع",
      location: context?.location,
      suggestion: "حاول مرة أخرى. إذا استمر الخطأ، تواصل مع الدعم الفني مع ذكر رقم المرجع",
    };
  }

  // String errors
  if (typeof error === "string") {
    return {
      id,
      category: "unknown",
      name: "Error",
      message: error,
      cause: "حدث خطأ غير متوقع",
      location: context?.location,
      suggestion: "حاول مرة أخرى. إذا استمر الخطأ، تواصل مع الدعم الفني",
    };
  }

  return {
    id,
    category: "unknown",
    name: "Unknown Error",
    message: "حدث خطأ غير معروف",
    cause: "لم يتم تحديد سبب الخطأ",
    location: context?.location,
    suggestion: "حاول مرة أخرى. إذا استمر الخطأ، تواصل مع الدعم الفني مع ذكر رقم المرجع",
  };
}

// ── Format error for API response (safe - no sensitive data) ─
export function formatApiError(error: unknown, context?: { location?: string; operation?: string }): {
  success: false;
  error: StructuredError;
} {
  const structured = parseError(error, context);
  
  // Strip sensitive information for API responses
  const safeError: StructuredError = {
    ...structured,
    details: structured.category === "prisma" ? undefined : structured.details,
  };
  
  return { success: false, error: safeError };
}

// ── Client-side error parser ─────────────────────────────────
export function parseClientError(error: unknown, componentName?: string): StructuredError {
  const id = `CLI-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  if (error instanceof Error) {
    // React hydration errors
    if (error.message.includes("insertBefore") || error.message.includes("hydration")) {
      return {
        id,
        category: "render",
        name: "React Hydration Error",
        message: "خطأ في مزامنة واجهة المستخدم",
        cause: "عدم تطابق بين محتوى الخادم والمتصفح. غالباً بسبب تغيير الثيم أو بيانات المستخدم بعد التحميل",
        location: componentName,
        suggestion: "أعد تحميل الصفحة. إذا استمر الخطأ، امسح ذاكرة التخزين المؤقت للمتصفح",
      };
    }

    // Chunk load errors
    if (error.message.includes("ChunkLoadError") || error.message.includes("Loading chunk")) {
      return {
        id,
        category: "network",
        name: "Resource Load Error",
        message: "فشل تحميل موارد التطبيق",
        cause: "تعذر تحميل جزء من التطبيق. ربما بسبب تحديث جديد أو مشكلة في الشبكة",
        location: componentName,
        suggestion: "أعد تحميل الصفحة بالكامل (Ctrl+Shift+R أو Cmd+Shift+R)",
      };
    }

    return {
      id,
      category: "unknown",
      name: error.name || "Error",
      message: error.message,
      cause: error.cause?.toString() || undefined,
      location: componentName,
      suggestion: "حاول مرة أخرى أو أعد تحميل الصفحة",
    };
  }

  return {
    id,
    category: "unknown",
    name: "Unknown Error",
    message: typeof error === "string" ? error : "حدث خطأ غير معروف",
    cause: undefined,
    location: componentName,
    suggestion: "أعد تحميل الصفحة",
  };
}
