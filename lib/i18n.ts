export const locales = ["en", "ar"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export function isLocale(value: string | undefined): value is Locale {
  return value === "en" || value === "ar";
}

export function getLocaleFromPath(pathname: string): Locale | null {
  const segment = pathname.split("/").filter(Boolean)[0];
  return isLocale(segment) ? segment : null;
}

export function stripLocaleFromPath(pathname: string) {
  const locale = getLocaleFromPath(pathname);
  if (!locale) return pathname || "/";
  const stripped = pathname.replace(new RegExp(`^/${locale}(?=/|$)`), "");
  return stripped || "/";
}

export function withLocale(pathname: string, locale: Locale) {
  const stripped = stripLocaleFromPath(pathname);
  return `/${locale}${stripped === "/" ? "" : stripped}`;
}

export function getDirection(locale: Locale) {
  return locale === "ar" ? "rtl" : "ltr";
}

export const dictionaries = {
  en: {
    common: { language: "Language", english: "English", arabic: "Arabic", dashboard: "Dashboard", signOut: "Sign out", signedInAs: "Signed in as", notifications: "Notifications", healthy: "Healthy", home: "Home" },
    auth: {
      title: "Sign in",
      description: "Administrators sign in with username. Employees sign in with national ID.",
      identifier: "Username or National ID",
      identifierPlaceholder: "admin or 1000000001",
      password: "Password",
      passwordPlaceholder: "Enter your secure password",
      forgotPassword: "Forgot password?",
      rememberTitle: "Remember this workspace",
      rememberDescription: "Save only your username or national ID on this device.",
      submit: "Sign in securely",
      invalidLogin: "Invalid username, national ID, password, or account status.",
      heroBadge: "Modern workforce operating system",
      heroTitle: "Run HR, payroll, talent, and compliance from one elegant command center.",
      heroDescription: "Secure employee records, attendance, contracts, recruitment, approvals, dashboards, and audit trails built for global teams in English and Arabic.",
      peopleAnalytics: "People analytics",
      liveSnapshot: "Live operations snapshot",
      zeroTrust: "Zero-trust access",
      payrollReady: "Payroll cycle ready"
    },
    dashboard: {
      badge: "Enterprise command center", title: "HRMS Dashboard", description: "Monitor people operations, approvals, hiring momentum, notifications, and governance activity from one executive workspace.", employees: "Employees", departments: "Departments", openJobs: "Open Jobs", pendingLeave: "Pending Leave", unreadNotifications: "Notifications", auditTitle: "Recent audit activity", auditDescription: "Latest sensitive changes across HRMS modules.", noAudit: "No audit activity yet.", healthTitle: "Operational health", healthDescription: "Production readiness indicators."
    },
    nav: {
      workspace: "Enterprise HR operations workspace", employees: "Employees", departments: "Departments", branches: "Branches", positions: "Positions", "employment-types": "Employment Types", nationalities: "Nationalities", documents: "Employee Documents", contracts: "Employee Contracts", attendance: "Attendance", "leave-types": "Leave Types", "leave-requests": "Leave Requests", "payroll-runs": "Payroll Runs", "payroll-items": "Payroll Items", loans: "Loans", overtime: "Overtime", allowances: "Allowances", deductions: "Deductions", performance: "Performance Evaluation", recruitment: "Recruitment", candidates: "Candidates", training: "Training", "training-enrollments": "Training Enrollments", assets: "Assets", announcements: "Announcements", notifications: "Notifications", reports: "Reports", settings: "Settings", "audit-logs": "Audit Logs"
    },
    table: { actions: "Actions", open: "Open", delete: "Delete", noRecords: "No records found", noRecordsDescription: "Create the first record or adjust your search and filters to widen the result set." },
    form: { select: "Select", saveChanges: "Save changes", createRecord: "Create record" }
  },
  ar: {
    common: { language: "\u0627\u0644\u0644\u063a\u0629", english: "English", arabic: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629", dashboard: "\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645", signOut: "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c", signedInAs: "\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0628\u0627\u0633\u0645", notifications: "\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a", healthy: "\u0633\u0644\u064a\u0645", home: "\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629" },
    auth: {
      title: "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644",
      description: "\u064a\u062f\u062e\u0644 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0628\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u060c \u0648\u064a\u062f\u062e\u0644 \u0627\u0644\u0645\u0648\u0638\u0641 \u0628\u0631\u0642\u0645 \u0627\u0644\u0647\u0648\u064a\u0629 \u0627\u0644\u0648\u0637\u0646\u064a\u0629.",
      identifier: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u0623\u0648 \u0631\u0642\u0645 \u0627\u0644\u0647\u0648\u064a\u0629 \u0627\u0644\u0648\u0637\u0646\u064a\u0629",
      identifierPlaceholder: "admin \u0623\u0648 1000000001",
      password: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631",
      passwordPlaceholder: "\u0623\u062f\u062e\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u0622\u0645\u0646\u0629",
      forgotPassword: "\u0646\u0633\u064a\u062a \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631\u061f",
      rememberTitle: "\u062a\u0630\u0643\u0631 \u0645\u0633\u0627\u062d\u0629 \u0627\u0644\u0639\u0645\u0644",
      rememberDescription: "\u0627\u062d\u0641\u0638 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u0623\u0648 \u0631\u0642\u0645 \u0627\u0644\u0647\u0648\u064a\u0629 \u0641\u0642\u0637 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u062c\u0647\u0627\u0632.",
      submit: "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0628\u0623\u0645\u0627\u0646",
      invalidLogin: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u0623\u0648 \u0631\u0642\u0645 \u0627\u0644\u0647\u0648\u064a\u0629 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0623\u0648 \u062d\u0627\u0644\u0629 \u0627\u0644\u062d\u0633\u0627\u0628 \u063a\u064a\u0631 \u0635\u062d\u064a\u062d\u0629.",
      heroBadge: "\u0646\u0638\u0627\u0645 \u062d\u062f\u064a\u062b \u0644\u0644\u0645\u0648\u0627\u0631\u062f \u0627\u0644\u0628\u0634\u0631\u064a\u0629",
      heroTitle: "\u0623\u062f\u0631 \u0627\u0644\u0645\u0648\u0627\u0631\u062f \u0627\u0644\u0628\u0634\u0631\u064a\u0629 \u0648\u0627\u0644\u0631\u0648\u0627\u062a\u0628 \u0648\u0627\u0644\u0645\u0648\u0627\u0647\u0628 \u0648\u0627\u0644\u0627\u0645\u062a\u062b\u0627\u0644 \u0645\u0646 \u0645\u0631\u0643\u0632 \u0648\u0627\u062d\u062f \u0623\u0646\u064a\u0642.",
      heroDescription: "\u0633\u062c\u0644\u0627\u062a \u0645\u0648\u0638\u0641\u064a\u0646 \u0622\u0645\u0646\u0629\u060c \u062d\u0636\u0648\u0631\u060c \u0639\u0642\u0648\u062f\u060c \u062a\u0648\u0638\u064a\u0641\u060c \u0645\u0648\u0627\u0641\u0642\u0627\u062a\u060c \u0644\u0648\u062d\u0627\u062a \u0628\u064a\u0627\u0646\u0627\u062a \u0648\u0633\u062c\u0644\u0627\u062a \u062a\u062f\u0642\u064a\u0642 \u0644\u0641\u0631\u0642 \u062a\u0639\u0645\u0644 \u0628\u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0648\u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629.",
      peopleAnalytics: "\u062a\u062d\u0644\u064a\u0644\u0627\u062a \u0627\u0644\u0645\u0648\u0638\u0641\u064a\u0646",
      liveSnapshot: "\u0644\u0645\u062d\u0629 \u062a\u0634\u063a\u064a\u0644\u064a\u0629 \u0645\u0628\u0627\u0634\u0631\u0629",
      zeroTrust: "\u0648\u0635\u0648\u0644 \u0622\u0645\u0646 \u062d\u0633\u0628 \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0627\u062a",
      payrollReady: "\u062f\u0648\u0631\u0629 \u0627\u0644\u0631\u0648\u0627\u062a\u0628 \u062c\u0627\u0647\u0632\u0629"
    },
    dashboard: { badge: "\u0645\u0631\u0643\u0632 \u0627\u0644\u0642\u064a\u0627\u062f\u0629", title: "\u0644\u0648\u062d\u0629 \u062a\u062d\u0643\u0645 \u0627\u0644\u0645\u0648\u0627\u0631\u062f \u0627\u0644\u0628\u0634\u0631\u064a\u0629", description: "\u0631\u0627\u0642\u0628 \u0639\u0645\u0644\u064a\u0627\u062a \u0627\u0644\u0645\u0648\u0638\u0641\u064a\u0646 \u0648\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0627\u062a \u0648\u0627\u0644\u062a\u0648\u0638\u064a\u0641 \u0648\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a.", employees: "\u0627\u0644\u0645\u0648\u0638\u0641\u0648\u0646", departments: "\u0627\u0644\u0625\u062f\u0627\u0631\u0627\u062a", openJobs: "\u0627\u0644\u0648\u0638\u0627\u0626\u0641", pendingLeave: "\u0627\u0644\u0625\u062c\u0627\u0632\u0627\u062a", unreadNotifications: "\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a", auditTitle: "\u0622\u062e\u0631 \u0623\u0646\u0634\u0637\u0629 \u0627\u0644\u062a\u062f\u0642\u064a\u0642", auditDescription: "\u0623\u062d\u062f\u062b \u0627\u0644\u062a\u063a\u064a\u064a\u0631\u0627\u062a \u0627\u0644\u062d\u0633\u0627\u0633\u0629.", noAudit: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u0646\u0634\u0637\u0629 \u062a\u062f\u0642\u064a\u0642 \u0628\u0639\u062f.", healthTitle: "\u0635\u062d\u0629 \u0627\u0644\u062a\u0634\u063a\u064a\u0644", healthDescription: "\u0645\u0624\u0634\u0631\u0627\u062a \u0627\u0644\u062c\u0627\u0647\u0632\u064a\u0629." },
    nav: { workspace: "\u0645\u0633\u0627\u062d\u0629 \u0639\u0645\u0644 \u0627\u0644\u0645\u0648\u0627\u0631\u062f \u0627\u0644\u0628\u0634\u0631\u064a\u0629", employees: "\u0627\u0644\u0645\u0648\u0638\u0641\u0648\u0646", departments: "\u0627\u0644\u0625\u062f\u0627\u0631\u0627\u062a", branches: "\u0627\u0644\u0641\u0631\u0648\u0639", positions: "\u0627\u0644\u0645\u0646\u0627\u0635\u0628", "employment-types": "\u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u062a\u0648\u0638\u064a\u0641", nationalities: "\u0627\u0644\u062c\u0646\u0633\u064a\u0627\u062a", documents: "\u0627\u0644\u0645\u0633\u062a\u0646\u062f\u0627\u062a", contracts: "\u0627\u0644\u0639\u0642\u0648\u062f", attendance: "\u0627\u0644\u062d\u0636\u0648\u0631", "leave-types": "\u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0625\u062c\u0627\u0632\u0627\u062a", "leave-requests": "\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0625\u062c\u0627\u0632\u0629", "payroll-runs": "\u062f\u0648\u0631\u0627\u062a \u0627\u0644\u0631\u0648\u0627\u062a\u0628", "payroll-items": "\u0628\u0646\u0648\u062f \u0627\u0644\u0631\u0648\u0627\u062a\u0628", loans: "\u0627\u0644\u0642\u0631\u0648\u0636", overtime: "\u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u0625\u0636\u0627\u0641\u064a", allowances: "\u0627\u0644\u0628\u062f\u0644\u0627\u062a", deductions: "\u0627\u0644\u062e\u0635\u0648\u0645\u0627\u062a", performance: "\u0627\u0644\u0623\u062f\u0627\u0621", recruitment: "\u0627\u0644\u062a\u0648\u0638\u064a\u0641", candidates: "\u0627\u0644\u0645\u0631\u0634\u062d\u0648\u0646", training: "\u0627\u0644\u062a\u062f\u0631\u064a\u0628", "training-enrollments": "\u062a\u0633\u062c\u064a\u0644\u0627\u062a \u0627\u0644\u062a\u062f\u0631\u064a\u0628", assets: "\u0627\u0644\u0623\u0635\u0648\u0644", announcements: "\u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062a", notifications: "\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a", reports: "\u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631", settings: "\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a", "audit-logs": "\u0633\u062c\u0644\u0627\u062a \u0627\u0644\u062a\u062f\u0642\u064a\u0642" },
    table: { actions: "\u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a", open: "\u0641\u062a\u062d", delete: "\u062d\u0630\u0641", noRecords: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0633\u062c\u0644\u0627\u062a", noRecordsDescription: "\u0623\u0646\u0634\u0626 \u0623\u0648\u0644 \u0633\u062c\u0644 \u0623\u0648 \u0639\u062f\u0644 \u0627\u0644\u0628\u062d\u062b \u0648\u0627\u0644\u062a\u0635\u0641\u064a\u0629." },
    form: { select: "\u0627\u062e\u062a\u0631", saveChanges: "\u062d\u0641\u0638 \u0627\u0644\u062a\u063a\u064a\u064a\u0631\u0627\u062a", createRecord: "\u0625\u0646\u0634\u0627\u0621 \u0633\u062c\u0644" }
  }
} as const;

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}