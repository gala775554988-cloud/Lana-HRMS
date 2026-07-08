export const saasSuites = [
  { key: "saas-billing", title: "SaaS Billing", features: ["subscription-plans", "trial", "invoices", "payments", "coupons", "usage-billing", "quotas", "license-management"] },
  { key: "customer-portal", title: "Customer Portal", features: ["customer-dashboard", "support", "billing", "company-settings", "team-members", "api-keys"] },
  { key: "public-marketplace", title: "Public Marketplace", features: ["extensions", "themes", "ai-packs", "workflow-packs", "integration-packs"] },
  { key: "plugin-sdk", title: "Plugin SDK", features: ["plugin-loader", "dynamic-routing", "hooks", "events", "permissions", "settings-api"] },
  { key: "deployment-center", title: "Deployment Center", features: ["deployment-history", "rollback", "release-channels", "canary", "blue-green", "feature-flags"] },
  { key: "backup-center", title: "Backup Center", features: ["manual-backup", "scheduled-backup", "restore", "point-in-time-restore", "storage-providers"] },
  { key: "disaster-recovery", title: "Disaster Recovery", features: ["replication", "failover", "recovery-plans", "health-monitoring"] },
  { key: "observability", title: "Observability", features: ["logs-explorer", "trace-explorer", "metrics-explorer", "alert-rules", "incident-timeline"] },
  { key: "performance-center", title: "Performance Center", features: ["query-analysis", "cache-metrics", "queue-metrics", "api-performance", "slow-requests"] },
  { key: "compliance-center", title: "Compliance Center", features: ["iso-27001", "soc2", "gdpr", "saudi-pdpl", "hipaa"] },
  { key: "localization", title: "Localization", features: ["rtl-ltr", "dynamic-languages", "currency", "timezone", "regional-calendars"] },
  { key: "mobile-platform", title: "Mobile Platform", features: ["react-native-apis", "offline-sync", "push", "device-management", "biometric-login"] },
  { key: "ai-enterprise", title: "AI Enterprise", features: ["ai-agent-framework", "autonomous-hr-agents", "ai-workflow-execution", "ai-report-generation", "ai-decision-support"] },
  { key: "data-warehouse", title: "Data Warehouse", features: ["etl", "data-lake", "historical-analytics", "kpi-cubes", "forecast-models"] },
  { key: "enterprise-automation", title: "Enterprise Automation", features: ["visual-automation-builder", "bpmn-support", "webhooks", "external-triggers", "scheduled-automation"] },
  { key: "quality", title: "Quality", features: ["unit-tests", "integration-tests", "e2e-tests", "load-tests", "security-tests", "ci-cd-pipeline"] }
] as const;
export function getSaasSuite(key: string) { return saasSuites.find((suite) => suite.key === key); }
export function titleFromSlug(slug: string) { return slug.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" "); }
