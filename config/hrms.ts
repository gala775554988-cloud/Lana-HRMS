export type FieldType = "text" | "email" | "textarea" | "date" | "number" | "boolean" | "select";

export type ModuleField = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: readonly string[];
  placeholder?: string;
  /** For type: "number" -- restricts input to whole numbers (step=1, min=0, no decimals). */
  integer?: boolean;
};

export type HrmsModule = {
  key: string;
  title: string;
  description: string;
  model: string;
  permissionResource: string;
  searchFields: readonly string[];
  filterFields: readonly string[];
  tableFields: readonly string[];
  fields: readonly ModuleField[];
};

const activeField: ModuleField = { name: "isActive", label: "Active", type: "boolean" };
const codeField: ModuleField = { name: "code", label: "Code", type: "text", required: true };
const descriptionField: ModuleField = { name: "description", label: "Description", type: "textarea" };
const employeeIdField: ModuleField = { name: "employeeId", label: "Employee ID", type: "text", required: true };

export const hrmsModules = [
  { key: "hospitals", title: "المستشفيات", description: "إدارة المستشفيات والفروع", model: "hospital", permissionResource: "hospitals", searchFields: ["name", "code"], filterFields: ["isActive"], tableFields: ["code", "name", "isActive"], fields: [{ name: "name", label: "Name", type: "text", required: true }] },
  {
    key: "employees",
    title: "Employees",
    description: "Manage employee profiles, assignments, and lifecycle status.",
    model: "employee",
    permissionResource: "employees",
    searchFields: ["employeeNumber", "nationalId", "firstName", "lastName", "email", "phone"],
    filterFields: ["status", "departmentId", "branchId"],
    tableFields: ["employeeNumber", "nationalId", "firstName", "lastName", "status", "hireDate"],
    fields: [
      { name: "employeeNumber", label: "Employee number", type: "text", required: true },
      { name: "nationalId", label: "National ID", type: "text", required: true },
      { name: "firstName", label: "First name", type: "text", required: true },
      { name: "lastName", label: "Last name", type: "text", required: true },
      { name: "email", label: "Email (optional)", type: "email" },
      { name: "profilePhotoUrl", label: "Profile photo URL", type: "text" },
      { name: "phone", label: "Phone", type: "text" },
      { name: "gender", label: "Gender", type: "select", options: ["Female", "Male", "Not specified"] },
      { name: "dateOfBirth", label: "Date of birth", type: "date" },
      { name: "hireDate", label: "Hire date", type: "date", required: true },
      { name: "status", label: "Status", type: "select", required: true, options: ["ACTIVE", "ON_LEAVE", "TERMINATED", "INACTIVE"] },
      { name: "positionId", label: "المنصب", type: "select", options: ["موظف", "مشرف", "مدير فرع", "مدير إدارة", "مدير مشاريع", "مدير الموارد البشرية", "مسؤول الرواتب", "مسؤول التأمين", "مسؤول الإقامة", "مسؤول الطلبات", "مسؤول المستلزمات", "مسؤول الأصول", "مسؤول التدريب", "مسؤول الأداء"] },
      { name: "departmentId", label: "Department ID", type: "text" },
      { name: "branchId", label: "Branch ID", type: "text" },
      { name: "employmentTypeId", label: "Employment type ID", type: "text" },
      { name: "nationalityId", label: "Nationality ID", type: "text" },
      { name: "hospitalId", label: "Hospital ID", type: "text" },
      { name: "costCenter", label: "Cost Center", type: "text" },
      { name: "analyticAccount", label: "Analytic Account", type: "text" },
      { name: "workLocationName", label: "Work Location", type: "text" },
      { name: "address", label: "Address", type: "textarea" },
    ]
  },
  {
    key: "departments", title: "Departments", description: "Organize teams and business units.", model: "department", permissionResource: "departments", searchFields: ["name", "code"], filterFields: ["isActive"], tableFields: ["code", "name", "isActive"], fields: [{ name: "name", label: "Name", type: "text", required: true }, codeField, descriptionField, activeField]
  },
  {
    key: "companies", title: "Companies", description: "Manage companies for multi-company approval routing.", model: "company", permissionResource: "companies", searchFields: ["name", "code"], filterFields: ["isActive"], tableFields: ["code", "name", "isActive"], fields: [{ name: "name", label: "Name", type: "text", required: true }, codeField, activeField]
  },
  {
    key: "projects", title: "Projects", description: "Fourth org-unit type for team/project-based approval routing and scoping.", model: "project", permissionResource: "projects", searchFields: ["name", "code"], filterFields: ["isActive"], tableFields: ["code", "name", "isActive"], fields: [{ name: "name", label: "Name", type: "text", required: true }, { name: "code", label: "Code", type: "text" }, activeField]
  },
  {
    key: "branches", title: "Branches", description: "Manage physical locations and offices.", model: "branch", permissionResource: "branches", searchFields: ["name", "code", "city", "country"], filterFields: ["isActive"], tableFields: ["code", "name", "city", "country", "isActive"], fields: [{ name: "name", label: "Name", type: "text", required: true }, codeField, { name: "address", label: "Address", type: "textarea" }, { name: "city", label: "City", type: "text" }, { name: "country", label: "Country", type: "text" }, activeField]
  },
  {
    key: "positions", title: "Positions", description: "Maintain job titles and position definitions.", model: "position", permissionResource: "positions", searchFields: ["title", "code"], filterFields: ["isActive", "departmentId"], tableFields: ["code", "title", "departmentId", "isActive"], fields: [{ name: "title", label: "Title", type: "text", required: true }, codeField, descriptionField, { name: "departmentId", label: "Department ID", type: "text" }, activeField]
  },
  {
    key: "employment-types", title: "Employment Types", description: "Classify full-time, part-time, contract, and temporary employees.", model: "employmentType", permissionResource: "employment-types", searchFields: ["name", "code"], filterFields: ["isActive"], tableFields: ["code", "name", "isActive"], fields: [{ name: "name", label: "Name", type: "text", required: true }, codeField, descriptionField, activeField]
  },
  {
    key: "nationalities", title: "Nationalities", description: "Reference data for employee nationality records.", model: "nationality", permissionResource: "nationalities", searchFields: ["name", "code"], filterFields: ["isActive"], tableFields: ["code", "name", "isActive"], fields: [{ name: "name", label: "Name", type: "text", required: true }, codeField, activeField]
  },
  {
    key: "documents", title: "Employee Documents", description: "Track employee files, expirations, and verification state.", model: "employeeDocument", permissionResource: "documents", searchFields: ["name", "type", "fileName"], filterFields: ["status", "employeeId"], tableFields: ["employeeId", "type", "name", "status", "expiresAt"], fields: [employeeIdField, { name: "type", label: "Type", type: "text", required: true }, { name: "name", label: "Name", type: "text", required: true }, { name: "fileUrl", label: "File URL", type: "text", required: true }, { name: "fileName", label: "File name", type: "text" }, { name: "mimeType", label: "MIME type", type: "text" }, { name: "sizeBytes", label: "Size bytes", type: "number" }, { name: "status", label: "Status", type: "select", options: ["PENDING", "VERIFIED", "REJECTED", "EXPIRED"] }, { name: "expiresAt", label: "Expires at", type: "date" }]
  },
  {
    key: "contracts", title: "Employee Contracts", description: "Manage employee agreements and compensation terms.", model: "employeeContract", permissionResource: "contracts", searchFields: ["contractNumber", "title", "currency"], filterFields: ["status", "employeeId"], tableFields: ["contractNumber", "employeeId", "title", "status", "salaryAmount"], fields: [employeeIdField, { name: "contractNumber", label: "Contract number", type: "text", required: true }, { name: "title", label: "Title", type: "text", required: true }, { name: "startDate", label: "Start date", type: "date", required: true }, { name: "endDate", label: "End date", type: "date" }, { name: "salaryAmount", label: "Salary amount", type: "number", required: true }, { name: "currency", label: "Currency", type: "text" }, { name: "status", label: "Status", type: "select", options: ["DRAFT", "ACTIVE", "EXPIRED", "TERMINATED"] }, { name: "signedAt", label: "Signed at", type: "date" }, { name: "attachmentUrl", label: "Attachment URL", type: "text" }]
  },
  {
    key: "attendance", title: "Attendance", description: "Record daily attendance, check-in, and check-out data.", model: "attendanceRecord", permissionResource: "attendance", searchFields: ["notes"], filterFields: ["status", "employeeId"], tableFields: ["employeeId", "workDate", "status", "checkIn", "checkOut"], fields: [employeeIdField, { name: "workDate", label: "Work date", type: "date", required: true }, { name: "checkIn", label: "Check in", type: "date" }, { name: "checkOut", label: "Check out", type: "date" }, { name: "status", label: "Status", type: "select", options: ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "REMOTE", "HOLIDAY"] }, { name: "notes", label: "Notes", type: "textarea" }]
  },
  {
    key: "leave-types", title: "Leave Types", description: "Configure paid and unpaid leave policies.", model: "leaveType", permissionResource: "leave", searchFields: ["name", "code"], filterFields: ["isActive", "isPaid"], tableFields: ["code", "name", "annualLimit", "isPaid", "isActive"], fields: [{ name: "name", label: "Name", type: "text", required: true }, codeField, descriptionField, { name: "annualLimit", label: "Annual limit", type: "number" }, { name: "isPaid", label: "Paid", type: "boolean" }, activeField]
  },
  {
    key: "leave-requests", title: "Leave Requests", description: "Submit, review, and approve employee leave.", model: "leaveRequest", permissionResource: "leave", searchFields: ["reason", "decisionNote"], filterFields: ["status", "employeeId", "leaveTypeId"], tableFields: ["employeeId", "leaveTypeId", "startDate", "endDate", "status"], fields: [employeeIdField, { name: "leaveTypeId", label: "Leave type ID", type: "text", required: true }, { name: "startDate", label: "Start date", type: "date", required: true }, { name: "endDate", label: "End date", type: "date", required: true }, { name: "days", label: "Days", type: "number", required: true }, { name: "reason", label: "Reason", type: "textarea" }, { name: "status", label: "Status", type: "select", options: ["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELLED"] }, { name: "decisionNote", label: "Decision note", type: "textarea" }]
  },
  {
    key: "payroll-periods", title: "Payroll Periods", description: "Formal open/processing/closed payroll periods.", model: "payrollPeriod", permissionResource: "payroll", searchFields: ["name"], filterFields: ["status"], tableFields: ["name", "startDate", "endDate", "status"], fields: [{ name: "name", label: "Name", type: "text", required: true }, { name: "startDate", label: "Start date", type: "date", required: true }, { name: "endDate", label: "End date", type: "date", required: true }, { name: "status", label: "Status", type: "select", options: ["OPEN", "PROCESSING", "CLOSED"] }]
  },
  {
    key: "payroll-cost-centers", title: "Cost Centers", description: "Accounting cost-center dimension for payroll runs.", model: "payrollCostCenter", permissionResource: "payroll", searchFields: ["name", "code"], filterFields: ["isActive"], tableFields: ["code", "name", "isActive"], fields: [{ name: "name", label: "Name", type: "text", required: true }, codeField, activeField]
  },
  {
    key: "payroll-runs", title: "Payroll Runs", description: "Manage payroll periods and payment status.", model: "payrollRun", permissionResource: "payroll", searchFields: ["name", "period"], filterFields: ["status", "periodId", "costCenterId"], tableFields: ["period", "name", "status", "paidAt"], fields: [{ name: "name", label: "Name", type: "text", required: true }, { name: "period", label: "Period", type: "text", required: true }, { name: "periodId", label: "Payroll period ID", type: "text" }, { name: "costCenterId", label: "Cost center ID", type: "text" }, { name: "companyId", label: "Company ID", type: "text" }, { name: "branchId", label: "Branch ID", type: "text" }, { name: "departmentId", label: "Department ID", type: "text" }, { name: "status", label: "Status", type: "select", options: ["DRAFT", "PROCESSING", "APPROVED", "PAID", "CANCELLED"] }, { name: "submittedAt", label: "Submitted at", type: "date" }, { name: "approvedAt", label: "Approved at", type: "date" }, { name: "paidAt", label: "Paid at", type: "date" }]
  },
  {
    key: "payroll-items", title: "Payroll Items", description: "Employee-level payroll calculations.", model: "payrollItem", permissionResource: "payroll", searchFields: ["currency"], filterFields: ["employeeId", "payrollRunId", "costCenterId"], tableFields: ["payrollRunId", "employeeId", "baseSalary", "grossPay", "netPay", "currency"], fields: [{ name: "payrollRunId", label: "Payroll run ID", type: "text", required: true }, employeeIdField, { name: "costCenterId", label: "Cost center ID", type: "text" }, { name: "baseSalary", label: "Base salary", type: "number", required: true }, { name: "allowanceTotal", label: "Allowance total", type: "number" }, { name: "bonusTotal", label: "Bonus total", type: "number" }, { name: "overtimeTotal", label: "Overtime total", type: "number" }, { name: "grossPay", label: "Gross pay", type: "number" }, { name: "insuranceDeduction", label: "Insurance deduction", type: "number" }, { name: "taxTotal", label: "Tax total", type: "number" }, { name: "loanDeduction", label: "Loan deduction", type: "number" }, { name: "advanceDeduction", label: "Advance deduction", type: "number" }, { name: "absenceDeduction", label: "Absence deduction", type: "number" }, { name: "lateDeduction", label: "Late deduction", type: "number" }, { name: "penaltyDeduction", label: "Penalty deduction", type: "number" }, { name: "deductionTotal", label: "Deduction total", type: "number" }, { name: "netPay", label: "Net pay", type: "number", required: true }, { name: "currency", label: "Currency", type: "text" }, { name: "paymentMethod", label: "Payment method", type: "select", options: ["TRANSFER", "CHECK", "CASH", "WALLET"] }]
  },
  {
    key: "bonuses", title: "Bonuses & Commissions", description: "Bonuses, commissions, incentives, and rewards.", model: "employeeBonus", permissionResource: "payroll", searchFields: ["reason"], filterFields: ["employeeId", "type", "status"], tableFields: ["employeeId", "type", "amount", "status", "awardedDate"], fields: [employeeIdField, { name: "type", label: "Type", type: "select", options: ["BONUS", "COMMISSION", "INCENTIVE", "REWARD"], required: true }, { name: "amount", label: "Amount", type: "number", required: true }, { name: "currency", label: "Currency", type: "text" }, { name: "reason", label: "Reason", type: "textarea", required: true }, { name: "awardedDate", label: "Awarded date", type: "date", required: true }, { name: "status", label: "Status", type: "select", options: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] }]
  },
  {
    key: "loans", title: "Loans", description: "Track employee loans and balances.", model: "loan", permissionResource: "loans", searchFields: ["loanNumber", "notes"], filterFields: ["status", "employeeId"], tableFields: ["loanNumber", "employeeId", "principalAmount", "outstandingAmount", "status"], fields: [employeeIdField, { name: "loanNumber", label: "Loan number", type: "text", required: true }, { name: "principalAmount", label: "Principal", type: "number", required: true }, { name: "outstandingAmount", label: "Outstanding", type: "number", required: true }, { name: "installmentAmount", label: "Installment", type: "number", required: true }, { name: "currency", label: "Currency", type: "text" }, { name: "issuedAt", label: "Issued at", type: "date", required: true }, { name: "status", label: "Status", type: "select", options: ["ACTIVE", "PAID", "DEFAULTED", "CANCELLED"] }, { name: "notes", label: "Notes", type: "textarea" }]
  },
  {
    key: "overtime", title: "Overtime", description: "Request and approve overtime hours.", model: "overtimeRequest", permissionResource: "overtime", searchFields: ["reason"], filterFields: ["status", "employeeId"], tableFields: ["employeeId", "workDate", "hours", "rate", "status"], fields: [employeeIdField, { name: "workDate", label: "Work date", type: "date", required: true }, { name: "hours", label: "Hours", type: "number", required: true }, { name: "rate", label: "Rate", type: "number" }, { name: "reason", label: "Reason", type: "textarea" }, { name: "status", label: "Status", type: "select", options: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] }]
  },
  {
    key: "allowances", title: "Allowances", description: "Recurring and one-time employee allowances.", model: "allowance", permissionResource: "allowances", searchFields: ["name", "currency"], filterFields: ["employeeId", "isRecurring"], tableFields: ["employeeId", "name", "amount", "currency", "isRecurring"], fields: [employeeIdField, { name: "name", label: "Name", type: "text", required: true }, { name: "amount", label: "Amount", type: "number", required: true }, { name: "currency", label: "Currency", type: "text" }, { name: "effectiveFrom", label: "Effective from", type: "date", required: true }, { name: "effectiveTo", label: "Effective to", type: "date" }, { name: "isRecurring", label: "Recurring", type: "boolean" }]
  },
  {
    key: "deductions", title: "Deductions", description: "Recurring and one-time employee deductions.", model: "deduction", permissionResource: "deductions", searchFields: ["name", "currency"], filterFields: ["employeeId", "isRecurring"], tableFields: ["employeeId", "name", "amount", "currency", "isRecurring"], fields: [employeeIdField, { name: "name", label: "Name", type: "text", required: true }, { name: "amount", label: "Amount", type: "number", required: true }, { name: "currency", label: "Currency", type: "text" }, { name: "effectiveFrom", label: "Effective from", type: "date", required: true }, { name: "effectiveTo", label: "Effective to", type: "date" }, { name: "isRecurring", label: "Recurring", type: "boolean" }]
  },
  {
    key: "performance", title: "Performance Evaluation", description: "Score employee performance and goals by period.", model: "performanceEvaluation", permissionResource: "performance", searchFields: ["period", "summary", "goals"], filterFields: ["status", "employeeId"], tableFields: ["employeeId", "period", "score", "status", "evaluatedAt"], fields: [employeeIdField, { name: "period", label: "Period", type: "text", required: true }, { name: "score", label: "Score", type: "number", required: true }, { name: "summary", label: "Summary", type: "textarea" }, { name: "goals", label: "Goals", type: "textarea" }, { name: "status", label: "Status", type: "select", options: ["DRAFT", "SUBMITTED", "APPROVED"] }, { name: "evaluatedAt", label: "Evaluated at", type: "date" }]
  },
  {
    key: "recruitment", title: "Recruitment", description: "Job openings for hiring pipelines.", model: "jobOpening", permissionResource: "recruitment", searchFields: ["title", "code", "description", "status"], filterFields: ["status"], tableFields: ["code", "title", "status", "openedAt", "closedAt"], fields: [{ name: "title", label: "Title", type: "text", required: true }, codeField, { name: "departmentId", label: "Department ID", type: "text" }, { name: "branchId", label: "Branch ID", type: "text" }, descriptionField, { name: "status", label: "Status", type: "text" }, { name: "openedAt", label: "Opened at", type: "date" }, { name: "closedAt", label: "Closed at", type: "date" }]
  },
  {
    key: "candidates", title: "Candidates", description: "Applicant profiles and hiring status.", model: "candidate", permissionResource: "recruitment", searchFields: ["firstName", "lastName", "email", "phone"], filterFields: ["status", "jobOpeningId"], tableFields: ["firstName", "lastName", "email", "status"], fields: [{ name: "jobOpeningId", label: "Job opening ID", type: "text" }, { name: "firstName", label: "First name", type: "text", required: true }, { name: "lastName", label: "Last name", type: "text", required: true }, { name: "email", label: "Email", type: "email", required: true }, { name: "phone", label: "Phone", type: "text" }, { name: "resumeUrl", label: "Resume URL", type: "text" }, { name: "status", label: "Status", type: "select", options: ["APPLIED", "SCREENING", "INTERVIEW", "OFFERED", "HIRED", "REJECTED"] }, { name: "notes", label: "Notes", type: "textarea" }]
  },
  {
    key: "training", title: "Training", description: "Training programs and providers.", model: "trainingProgram", permissionResource: "training", searchFields: ["title", "code", "provider"], filterFields: ["status"], tableFields: ["code", "title", "provider", "status"], fields: [{ name: "title", label: "Title", type: "text", required: true }, codeField, { name: "provider", label: "Provider", type: "text" }, { name: "startDate", label: "Start date", type: "date" }, { name: "endDate", label: "End date", type: "date" }, { name: "status", label: "Status", type: "select", options: ["PLANNED", "OPEN", "COMPLETED", "CANCELLED"] }, descriptionField]
  },
  {
    key: "training-enrollments", title: "Training Enrollments", description: "Employee participation in training programs.", model: "trainingEnrollment", permissionResource: "training", searchFields: [], filterFields: ["employeeId", "trainingProgramId", "status"], tableFields: ["trainingProgramId", "employeeId", "status", "completedAt", "score"], fields: [{ name: "trainingProgramId", label: "Training program ID", type: "text", required: true }, employeeIdField, { name: "status", label: "Status", type: "select", options: ["PLANNED", "OPEN", "COMPLETED", "CANCELLED"] }, { name: "completedAt", label: "Completed at", type: "date" }, { name: "score", label: "Score", type: "number" }]
  },
  {
    key: "assets", title: "Assets", description: "Company assets and employee assignments.", model: "asset", permissionResource: "assets", searchFields: ["assetTag", "name", "category", "serialNumber"], filterFields: ["status", "assignedEmployeeId"], tableFields: ["assetTag", "name", "category", "status", "assignedEmployeeId"], fields: [{ name: "assetTag", label: "Asset tag", type: "text", required: true }, { name: "name", label: "Name", type: "text", required: true }, { name: "category", label: "Category", type: "text", required: true }, { name: "serialNumber", label: "Serial number", type: "text" }, { name: "status", label: "Status", type: "select", options: ["AVAILABLE", "ASSIGNED", "MAINTENANCE", "RETIRED"] }, { name: "assignedEmployeeId", label: "Assigned employee ID", type: "text" }, { name: "assignedAt", label: "Assigned at", type: "date" }, { name: "returnedAt", label: "Returned at", type: "date" }]
  },
  {
    key: "announcements", title: "Announcements", description: "Publish company-wide and targeted updates.", model: "announcement", permissionResource: "announcements", searchFields: ["title", "body", "audience"], filterFields: ["isPublished"], tableFields: ["title", "audience", "isPublished", "publishedAt"], fields: [{ name: "title", label: "Title", type: "text", required: true }, { name: "body", label: "Body", type: "textarea", required: true }, { name: "audience", label: "Audience", type: "text" }, { name: "publishedAt", label: "Published at", type: "date" }, { name: "expiresAt", label: "Expires at", type: "date" }, { name: "isPublished", label: "Published", type: "boolean" }]
  },
  {
    key: "notifications", title: "Notifications", description: "User notifications and read state.", model: "notification", permissionResource: "notifications", searchFields: ["title", "body"], filterFields: ["type", "userId"], tableFields: ["title", "type", "userId", "readAt"], fields: [{ name: "userId", label: "User ID", type: "text" }, { name: "title", label: "Title", type: "text", required: true }, { name: "body", label: "Body", type: "textarea", required: true }, { name: "type", label: "Type", type: "select", options: ["INFO", "SUCCESS", "WARNING", "ERROR"] }, { name: "readAt", label: "Read at", type: "date" }]
  },
  {
    key: "reports", title: "Reports", description: "Reusable report definitions for HR analytics.", model: "reportDefinition", permissionResource: "reports", searchFields: ["name", "code", "module"], filterFields: ["isActive", "module"], tableFields: ["code", "name", "module", "isActive"], fields: [{ name: "name", label: "Name", type: "text", required: true }, codeField, descriptionField, { name: "module", label: "Module", type: "text", required: true }, activeField]
  },
  {
    key: "settings", title: "Settings", description: "Application-level settings and configuration values.", model: "appSetting", permissionResource: "settings", searchFields: ["key", "description"], filterFields: ["isSecret"], tableFields: ["key", "description", "isSecret"], fields: [{ name: "key", label: "Key", type: "text", required: true }, { name: "value", label: "JSON value", type: "textarea", required: true }, descriptionField, { name: "isSecret", label: "Secret", type: "boolean" }]
  },
  {
    key: "audit-logs", title: "Audit Logs", description: "Immutable trail of sensitive HRMS changes.", model: "auditLog", permissionResource: "audit-logs", searchFields: ["action", "entity", "entityId"], filterFields: ["entity", "actorUserId"], tableFields: ["action", "entity", "entityId", "actorUserId", "createdAt"], fields: [{ name: "action", label: "Action", type: "text", required: true }, { name: "entity", label: "Entity", type: "text", required: true }, { name: "entityId", label: "Entity ID", type: "text" }, { name: "metadata", label: "JSON metadata", type: "textarea" }]
  },
  {
    key: "shifts", title: "Shifts", description: "Define work shifts and their hours.", model: "shift", permissionResource: "shifts", searchFields: ["name", "code"], filterFields: ["isActive"], tableFields: ["code", "name", "startTime", "endTime", "daysOfWeek", "isActive"], fields: [{ name: "name", label: "Name", type: "text", required: true }, codeField, { name: "startTime", label: "Start time (HH:mm)", type: "text", required: true, placeholder: "08:00" }, { name: "endTime", label: "End time (HH:mm)", type: "text", required: true, placeholder: "16:00" }, { name: "daysOfWeek", label: "Days (comma-separated)", type: "text", required: true, placeholder: "SUN,MON,TUE,WED,THU" }, activeField]
  },
  {
    key: "shift-assignments", title: "Shift Roster", description: "Assign employees to shifts.", model: "shiftAssignment", permissionResource: "shifts", searchFields: [], filterFields: ["employeeId", "shiftId", "isActive"], tableFields: ["employeeId", "shiftId", "effectiveFrom", "effectiveTo", "isActive"], fields: [employeeIdField, { name: "shiftId", label: "Shift ID", type: "text", required: true }, { name: "effectiveFrom", label: "Effective from", type: "date", required: true }, { name: "effectiveTo", label: "Effective to", type: "date" }, activeField]
  },
  {
    key: "insurance", title: "Insurance Policies", description: "Manage employee insurance policies, coverage, and renewal dates.", model: "insurancePolicy", permissionResource: "insurance", searchFields: ["policyNumber", "provider"], filterFields: ["status", "employeeId", "category"], tableFields: ["policyNumber", "employeeId", "provider", "coverageType", "category", "dependentsCount", "endDate", "status"], fields: [employeeIdField, { name: "policyNumber", label: "Policy number", type: "text", required: true }, { name: "provider", label: "Provider", type: "text", required: true }, { name: "coverageType", label: "Coverage type", type: "text" }, { name: "category", label: "Category", type: "select", options: ["VIP", "A", "B", "C", "NA"] }, { name: "dependentsCount", label: "Number of dependents", type: "number", integer: true }, { name: "startDate", label: "Start date", type: "date", required: true }, { name: "endDate", label: "End date", type: "date", required: true }, { name: "status", label: "Status", type: "select", options: ["ACTIVE", "EXPIRED", "CANCELLED"] }, { name: "documentUrl", label: "Policy document", type: "text" }, { name: "documentName", label: "Document name", type: "text" }, { name: "notes", label: "Notes", type: "textarea" }]
  }
] as const satisfies HrmsModule[];

export type HrmsModuleKey = (typeof hrmsModules)[number]["key"];

export function getHrmsModule(key: string) {
  return hrmsModules.find((resource) => resource.key === key);
}

export const hrmsNavigation = hrmsModules.map((resource) => ({
  key: resource.key,
  href: "/" + resource.key,
  label: resource.title,
  resource: resource.permissionResource
}));
