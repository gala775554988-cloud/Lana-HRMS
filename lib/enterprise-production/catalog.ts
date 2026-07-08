export const productionAreas = [
  { key: "dashboard-engine", title: "Dashboard Engine", model: "productionAreaRecord", features: ["dynamic-builder", "widgets", "charts", "kpis", "filters", "saved-dashboards", "executive-dashboard", "hr-dashboard", "ceo-dashboard", "manager-dashboard"] },
  { key: "workflow-engine", title: "Workflow Engine", model: "workflowDefinition", features: ["visual-builder", "approval-chains", "dynamic-conditions", "sla", "escalation", "delegation", "parallel-approval", "sequential-approval"] },
  { key: "report-designer", title: "Report Designer", model: "reportDesign", features: ["drag-drop-builder", "pdf", "excel", "csv", "scheduled-reports", "email-reports"] },
  { key: "notification-center", title: "Notification Center", model: "notificationTemplate", features: ["email", "sms", "whatsapp", "push", "in-app", "templates", "scheduling", "retry-queue"] },
  { key: "audit-center", title: "Audit Center", model: "auditLog", features: ["activity-logs", "login-logs", "crud-logs", "api-logs", "export-logs"] },
  { key: "enterprise-search", title: "Enterprise Search", model: "enterpriseSearchIndex", features: ["global-search", "full-text-search", "filters", "indexing"] },
  { key: "file-center", title: "File Center", model: "fileCenterDocument", features: ["versioning", "ocr-ready", "preview", "approval", "expiration"] },
  { key: "bi-analytics", title: "BI Analytics", model: "bIInsight", features: ["kpis", "heatmaps", "trends", "forecasts", "executive-metrics"] },
  { key: "ai-center", title: "AI Center", model: "aIPromptLibraryItem", features: ["ai-hr-assistant", "prompt-library", "hr-insights", "predictive-analytics", "natural-language-reports"] },
  { key: "api-gateway", title: "API Gateway", model: "apiGatewayEndpoint", features: ["versioning", "rate-limiting", "api-keys", "oauth2", "webhooks", "api-documentation"] },
  { key: "monitoring", title: "Monitoring", model: "monitoringMetric", features: ["health-checks", "background-jobs", "queue-monitoring", "performance-metrics"] },
  { key: "security", title: "Security", model: "securityPolicy", features: ["mfa", "password-policy", "session-management", "device-management", "login-history"] }
] as const;

export function getProductionArea(key: string) {
  return productionAreas.find((area) => area.key === key);
}

export function titleFromKey(key: string) {
  return key.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
