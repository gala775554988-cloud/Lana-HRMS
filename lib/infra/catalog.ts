export const infraAreas = [
  { key: "event-bus", title: "Event Bus", model: "eventStoreRecord", features: ["event-store", "domain-events", "event-publisher", "event-subscribers", "retry", "dead-letter-queue", "event-replay"] },
  { key: "message-queue", title: "Message Queue", model: "messageQueueRecord", features: ["rabbitmq-ready", "redis-queue", "queue-dashboard", "workers", "retry-strategy", "delayed-jobs"] },
  { key: "scheduler", title: "Scheduler", model: "schedulerRecord", features: ["cron-builder", "scheduled-jobs", "calendar-jobs", "retry", "failed-jobs", "job-history"] },
  { key: "notification-pipeline", title: "Notification Pipeline", model: "notificationPipelineRecord", features: ["email-queue", "sms-queue", "whatsapp-queue", "push-queue", "retry-queue", "failure-queue"] },
  { key: "audit-intelligence", title: "Audit Intelligence", model: "auditIntelligenceRecord", features: ["user-timeline", "object-timeline", "before-after-changes", "field-level-tracking", "ip-tracking", "device-tracking"] },
  { key: "integration-hub", title: "Integration Hub", model: "infrastructureConnector", features: ["sap", "oracle", "microsoft-dynamics", "odoo", "zoho", "bamboohr", "workday", "successfactors", "ldap", "active-directory"] },
  { key: "ai-copilot", title: "AI Copilot", model: "aICopilotRecord", features: ["ai-chat", "ai-sql-generator", "ai-report-builder", "ai-dashboard-builder", "ai-workflow-generator", "ai-email-writer", "ai-policy-generator", "ai-recruitment-assistant", "ai-payroll-assistant"] },
  { key: "document-ai", title: "Document AI", model: "documentAIRecord", features: ["ocr", "pdf-parser", "resume-parser", "contract-parser", "arabic-ocr", "english-ocr", "entity-extraction"] },
  { key: "bi-engine", title: "BI Engine", model: "bIEngineRecord", features: ["cube-engine", "pivot-tables", "dynamic-kpi-builder", "dashboard-builder", "drill-through", "forecast-engine", "trend-detection"] },
  { key: "security-enterprise", title: "Security Enterprise", model: "securityEnterpriseRecord", features: ["sso", "oauth2", "openid-connect", "saml", "azure-ad", "google-workspace", "mfa", "device-trust", "risk-score", "session-analytics"] },
  { key: "devops-center", title: "DevOps Center", model: "devOpsCenterRecord", features: ["environment-manager", "secrets-manager", "feature-flags", "release-notes", "deployment-history", "rollback"] },
  { key: "monitoring-enterprise", title: "Monitoring Enterprise", model: "monitoringEnterpriseRecord", features: ["prometheus-ready", "grafana-ready", "opentelemetry", "tracing", "slow-queries", "error-analytics", "api-metrics"] },
  { key: "database-studio", title: "Database Studio", model: "databaseStudioRecord", features: ["er-diagram", "schema-browser", "migration-history", "seed-manager", "backup-manager", "restore-manager"] },
  { key: "enterprise-admin-center", title: "Enterprise Admin Center", model: "enterpriseAdminRecord", features: ["tenant-management", "license-management", "subscription-plans", "usage-analytics", "billing-ready", "system-configuration"] },
  { key: "white-label-platform", title: "White Label Platform", model: "whiteLabelRecord", features: ["logo", "theme", "fonts", "colors", "domain-mapping", "email-branding", "login-branding"] },
  { key: "marketplace", title: "Marketplace", model: "marketplacePlugin", features: ["plugin-sdk", "plugin-registry", "install-uninstall", "versioning", "dependencies"] }
] as const;
export function getInfraArea(key: string) { return infraAreas.find((area) => area.key === key); }
export function titleFromSlug(slug: string) { return slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
