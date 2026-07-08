export const integrationPages = [
  { href: "/integrations", label: "Dashboard" },
  { href: "/integrations/providers", label: "Providers" },
  { href: "/integrations/connections", label: "Connections" },
  { href: "/integrations/mappings", label: "Mappings" },
  { href: "/integrations/synchronization", label: "Synchronization" },
  { href: "/integrations/queues", label: "Queues" },
  { href: "/integrations/jobs", label: "Jobs" },
  { href: "/integrations/logs", label: "Logs" },
  { href: "/integrations/webhooks", label: "Webhooks" },
  { href: "/integrations/api-keys", label: "API Keys" },
  { href: "/integrations/oauth-clients", label: "OAuth Clients" },
  { href: "/integrations/settings", label: "Settings" },
] as const;

export const odooModuleMappings = [
  { hrmsModule: "employees", hrmsModel: "employee", externalModel: "hr.employee", fieldMap: { firstName: "name", email: "work_email", phone: "work_phone", employeeNumber: "barcode" } },
  { hrmsModule: "departments", hrmsModel: "department", externalModel: "hr.department", fieldMap: { name: "name", code: "code" } },
  { hrmsModule: "branches", hrmsModel: "branch", externalModel: "res.company", fieldMap: { name: "name", city: "city", country: "country_id" } },
  { hrmsModule: "hospitals", hrmsModel: "hospital", externalModel: "res.partner", fieldMap: { name: "name", code: "ref" } },
  { hrmsModule: "attendance", hrmsModel: "attendanceRecord", externalModel: "hr.attendance", fieldMap: { checkIn: "check_in", checkOut: "check_out" } },
  { hrmsModule: "leave-requests", hrmsModel: "leaveRequest", externalModel: "hr.leave", fieldMap: { startDate: "request_date_from", endDate: "request_date_to", reason: "name" } },
  { hrmsModule: "payroll-items", hrmsModel: "payrollItem", externalModel: "hr.payslip", fieldMap: { baseSalary: "basic_wage", netPay: "net_wage" } },
  { hrmsModule: "contracts", hrmsModel: "employeeContract", externalModel: "hr.contract", fieldMap: { title: "name", startDate: "date_start", endDate: "date_end", salaryAmount: "wage" } },
  { hrmsModule: "positions", hrmsModel: "position", externalModel: "hr.job", fieldMap: { title: "name", code: "code", description: "description" } },
  { hrmsModule: "assets", hrmsModel: "asset", externalModel: "maintenance.equipment", fieldMap: { name: "name", serialNumber: "serial_no", assetTag: "equipment_assign_to" } },
  { hrmsModule: "training", hrmsModel: "trainingProgram", externalModel: "event.event", fieldMap: { title: "name", startDate: "date_begin", endDate: "date_end" } },
  { hrmsModule: "performance", hrmsModel: "performanceEvaluation", externalModel: "hr.appraisal", fieldMap: { period: "name", summary: "note", score: "final_rating" } },
] as const;
