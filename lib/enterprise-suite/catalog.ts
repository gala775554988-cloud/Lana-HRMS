export const enterpriseSuites = [
  { key: "recruitment", title: "Recruitment", features: ["job-requisitions", "vacancies", "careers-portal", "candidate-portal", "resume-upload", "interview-scheduler", "interview-evaluation", "offer-letters", "hiring-workflow", "candidate-pipeline"] },
  { key: "onboarding", title: "Onboarding", features: ["checklist", "documents", "assets-assignment", "orientation", "tasks", "email-notifications"] },
  { key: "lifecycle", title: "Employee Lifecycle", features: ["promotion", "transfer", "rotation", "suspension", "termination", "retirement", "exit-interview", "clearance"] },
  { key: "performance-enterprise", title: "Performance", features: ["kpi", "okr", "goal-tree", "competencies", "evaluation-cycle", "calibration", "360-feedback", "rewards"] },
  { key: "learning", title: "Learning", features: ["lms", "courses", "lessons", "quizzes", "certificates", "trainers", "attendance", "completion-tracking"] },
  { key: "payroll-enterprise", title: "Payroll", features: ["payroll-engine", "formula-builder", "tax", "gosi", "loans", "advances", "bonuses", "overtime", "deductions", "payslip-pdf", "payroll-history"] },
  { key: "attendance-enterprise", title: "Attendance", features: ["face-recognition", "qr-attendance", "gps-attendance", "fingerprint-devices", "shift-planning", "rotation", "late-rules", "overtime-rules", "geofencing"] },
  { key: "leave-enterprise", title: "Leave", features: ["leave-balance", "carry-forward", "accrual", "approval-workflow", "calendar"] },
  { key: "organization", title: "Organization", features: ["company", "branch", "hospital", "department", "section", "position", "cost-center", "organization-tree"] },
  { key: "documents-enterprise", title: "Documents", features: ["upload", "versioning", "expiration", "ocr-ready", "categories"] },
  { key: "assets-enterprise", title: "Assets", features: ["barcode", "qr", "assignment", "maintenance", "inventory"] },
  { key: "workflow-engine", title: "Workflow Engine", features: ["dynamic-steps", "conditions", "multi-level-approval", "delegation", "escalation", "sla"] },
  { key: "notifications-enterprise", title: "Notifications", features: ["email", "sms", "whatsapp", "push", "in-app-notifications"] },
  { key: "analytics-enterprise", title: "Analytics", features: ["charts", "kpis", "executive-dashboard", "hr-dashboard", "ceo-dashboard"] },
  { key: "ai-enterprise", title: "Lana AI", features: ["chat", "reports", "insights", "hr-assistant", "prompt-library"] },
  { key: "security-enterprise", title: "Security", features: ["rbac", "audit-log", "activity-log", "session-management", "password-policy", "mfa"] }
] as const;

export function getEnterpriseSuite(key: string) {
  return enterpriseSuites.find((suite) => suite.key === key);
}

export function getEnterpriseFeature(suiteKey: string, featureKey: string) {
  const suite = getEnterpriseSuite(suiteKey);
  if (!suite || !suite.features.includes(featureKey as never)) return null;
  return { suite, key: featureKey, title: featureKey.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") };
}
