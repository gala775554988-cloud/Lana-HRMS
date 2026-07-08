export const intelligentAreas = [
  { key: "digital-twin", title: "Digital Twin", model: "digitalTwinScenario", features: ["organization-simulation", "workforce-simulation", "hiring-simulation", "budget-impact-simulation", "promotion-simulation", "department-growth-simulation", "scenario-comparison", "ai-recommendations"] },
  { key: "decision-engine", title: "AI Decision Engine", model: "decisionExecution", features: ["ai-recommendation-engine", "auto-approvals", "policy-execution", "risk-scoring", "confidence", "reason-generation", "human-approval-fallback"] },
  { key: "knowledge-graph", title: "Knowledge Graph", model: "knowledgeNode", features: ["employee-graph", "organization-graph", "reporting-graph", "skill-graph", "position-graph", "search-graph"] },
  { key: "global-search", title: "Global Search Engine", model: "globalSearchDocument", features: ["vector-ready-search", "semantic-search", "ai-search", "fuzzy-search", "ocr-search", "document-search", "employee-search", "everything-search"] },
  { key: "real-ai-assistant", title: "Real AI Assistant", model: "aIAssistantConversation", features: ["conversation-history", "memory", "context", "tool-calling", "action-execution", "sql-generation", "report-generation", "dashboard-generation", "workflow-generation", "prompt-library"] },
  { key: "low-code-platform", title: "Low Code Platform", model: "lowCodeArtifact", features: ["visual-form-builder", "visual-workflow-builder", "visual-dashboard-builder", "visual-report-builder", "visual-approval-builder", "visual-rule-builder", "json-schema-storage"] },
  { key: "process-mining", title: "Process Mining", model: "processMiningInsight", features: ["workflow-replay", "bottleneck-detection", "process-optimization", "heat-maps", "execution-analytics"] },
  { key: "data-fabric", title: "Enterprise Data Fabric", model: "dataFabricAsset", features: ["unified-data-catalog", "metadata", "lineage", "data-quality", "master-data"] },
  { key: "predictive-analytics", title: "Predictive Analytics", model: "predictiveRun", features: ["attrition-prediction", "promotion-prediction", "hiring-forecast", "attendance-forecast", "payroll-forecast", "budget-forecast", "leave-forecast"] },
  { key: "generative-reports", title: "Generative Reports", model: "generativeReport", features: ["pdf", "excel", "word", "powerpoint", "email-summaries", "executive-summaries"] },
  { key: "observability", title: "Observability", model: "observabilitySpan", features: ["opentelemetry", "distributed-tracing", "metrics", "logs", "error-aggregation", "performance-analytics"] },
  { key: "edge-platform", title: "Edge Platform", model: "edgeSyncRecord", features: ["offline-synchronization", "edge-cache", "sync-queue", "conflict-resolution"] },
  { key: "global-multi-region", title: "Global Multi Region", model: "multiRegionConfig", features: ["multi-region", "geo-routing", "disaster-recovery", "replication"] },
  { key: "zero-trust-security", title: "Zero Trust Security", model: "zeroTrustPolicy", features: ["continuous-verification", "device-posture", "conditional-access", "risk-based-authentication", "adaptive-mfa"] }
] as const;
export function getIntelligentArea(key: string) { return intelligentAreas.find((area) => area.key === key); }
export function titleFromSlug(slug: string) { return slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
