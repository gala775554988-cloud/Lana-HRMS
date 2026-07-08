export const erpSuites = [
  { key: "erp-financial", title: "ERP Financial Suite", features: ["general-ledger", "chart-of-accounts", "cost-centers", "budgeting", "journal-entries", "bank-accounts", "bank-reconciliation", "treasury", "cash-flow", "fixed-assets-accounting"] },
  { key: "procurement", title: "Procurement Suite", features: ["vendors", "rfq", "purchase-orders", "approvals", "goods-receipt", "vendor-evaluation", "purchase-contracts"] },
  { key: "inventory", title: "Inventory", features: ["warehouses", "stock", "barcode", "qr", "batches", "lots", "expiration", "transfers", "adjustments"] },
  { key: "medical-erp", title: "Medical ERP", features: ["clinics", "doctors", "nursing", "laboratory", "pharmacy", "medical-inventory", "insurance", "claims", "patient-referrals"] },
  { key: "crm", title: "CRM", features: ["leads", "opportunities", "customers", "pipeline", "activities", "meetings", "sales-dashboard"] },
  { key: "help-desk", title: "Help Desk", features: ["tickets", "sla", "priority", "categories", "assignments", "knowledge-base"] },
  { key: "visitor-management", title: "Visitor Management", features: ["visitors", "qr-check-in", "temporary-badge", "meetings", "approvals"] },
  { key: "fleet", title: "Fleet", features: ["vehicles", "drivers", "fuel", "maintenance", "gps"] },
  { key: "mobile-backend", title: "Mobile Backend", features: ["push-notifications", "offline-sync", "mobile-apis", "mobile-authentication", "device-registration"] },
  { key: "real-ai", title: "AI", features: ["ai-resume-screening", "ai-leave-recommendation", "ai-payroll-analysis", "ai-attrition-prediction", "ai-interview-summary", "ai-performance-insights", "ai-executive-reports"] },
  { key: "real-bi", title: "BI", features: ["drill-down", "pivot", "kpi-designer", "custom-widgets", "executive-cockpit", "heatmaps", "forecast-models"] },
  { key: "workflow-designer", title: "Workflow Designer", features: ["drag-drop", "camunda-style", "power-automate-style", "n8n-style", "nodes", "edges", "executions"] },
  { key: "multi-tenancy", title: "Multi Tenancy", features: ["tenant-isolation", "tenant-database", "tenant-branding", "tenant-settings", "tenant-domains"] },
  { key: "public-apis", title: "Public APIs", features: ["swagger", "openapi", "graphql", "api-versioning", "api-documentation", "sdk-generation"] },
  { key: "production-hardening", title: "Production Hardening", features: ["redis-cache", "queue-workers", "background-jobs", "scheduler", "distributed-locks", "health-checks", "metrics", "tracing", "opentelemetry", "rate-limiting", "security-headers", "csp", "xss", "csrf", "sql-injection-protection"] }
] as const;
export function getErpSuite(key: string) { return erpSuites.find((suite) => suite.key === key); }
export function titleFromSlug(slug: string) { return slug.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" "); }
