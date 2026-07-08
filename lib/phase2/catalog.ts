export const phase2Suites = [
  { key: "recruitment-suite", title: "Recruitment Suite", features: ["careers-portal", "candidate-portal", "resume-parsing", "interview-scheduler", "interview-calendar", "offer-letters", "hiring-workflow", "candidate-pipeline", "talent-pool", "job-requisition-approval"] },
  { key: "lms", title: "LMS", features: ["courses", "lessons", "exams", "certificates", "learning-paths", "trainers", "classroom-sessions", "attendance", "scorm-ready"] },
  { key: "payroll-engine", title: "Payroll Engine", features: ["formula-builder", "payroll-processor", "tax-engine", "gosi", "eos-calculator", "loans", "advances", "bonuses", "deductions", "payslip-generator", "payroll-closing"] },
  { key: "attendance-enterprise", title: "Attendance Enterprise", features: ["face-recognition", "qr-attendance", "gps-attendance", "fingerprint-devices", "device-synchronization", "shift-planning", "rotations", "overtime-rules", "geofencing"] },
  { key: "performance-enterprise", title: "Performance Enterprise", features: ["kpi-engine", "okr-engine", "goal-tree", "360-feedback", "competencies", "calibration", "rewards", "performance-cycle"] },
  { key: "asset-management", title: "Asset Management", features: ["asset-inventory", "qr", "barcode", "assignment", "return", "maintenance", "warranty", "depreciation"] },
  { key: "medical-module", title: "Medical Module", features: ["hospitals", "clinics", "doctors", "nurses", "medical-staff", "departments", "shifts", "credentials", "licenses"] },
  { key: "financial-integration", title: "Financial Integration", features: ["sap", "oracle", "dynamics", "odoo", "zoho", "quickbooks", "bidirectional-sync"] },
  { key: "bi", title: "BI", features: ["executive-dashboards", "ceo-dashboards", "hr-dashboards", "real-kpis", "forecast", "heatmaps", "drill-down"] },
  { key: "ai", title: "AI", features: ["predictive-hr", "attrition-prediction", "salary-prediction", "hiring-recommendation", "natural-language-analytics", "ai-assistant", "prompt-library"] },
  { key: "mobile-api", title: "Mobile API", features: ["employee-mobile-api", "manager-api", "push-notifications", "offline-sync"] },
  { key: "multi-company", title: "Multi Company", features: ["unlimited-companies", "unlimited-branches", "unlimited-hospitals", "company-isolation", "rbac-isolation"] },
  { key: "compliance", title: "Compliance", features: ["saudi-labor-law", "gosi", "wps", "gdpr-ready", "iso-ready", "audit-ready"] }
] as const;

export function getPhase2Suite(key: string) {
  return phase2Suites.find((suite) => suite.key === key);
}

export function titleFromSlug(slug: string) {
  return slug.split("-").map((item) => item.charAt(0).toUpperCase() + item.slice(1)).join(" ");
}
