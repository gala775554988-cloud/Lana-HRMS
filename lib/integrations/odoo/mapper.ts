import type { LanaAttendance, LanaContract, LanaDepartment, LanaEmployee, LanaLeave, LanaPayrollItem, MapperDefinition, OdooRecord, OdooWriteValues, SyncConflict, SyncEntity } from "./types";

export const ODOO_MAPPERS: Record<string, MapperDefinition> = {
  employees: {
    entity: "employees",
    lanaModel: "employee",
    odooModel: "hr.employee",
    keyField: "employeeNumber",
    externalKeyField: "barcode",
    odooFields: ["id", "name", "barcode", "identification_id", "work_email", "work_phone", "mobile_phone", "gender", "active", "department_id", "job_id", "create_date", "write_date"],
    fieldMap: {
      employeeNumber: "barcode",
      nationalId: "identification_id",
      email: "work_email",
      phone: "work_phone",
      gender: "gender"
    }
  },
  departments: {
    entity: "departments",
    lanaModel: "department",
    odooModel: "hr.department",
    keyField: "code",
    externalKeyField: "code",
    odooFields: ["id", "name", "code", "active", "note", "create_date", "write_date"],
    fieldMap: { name: "name", code: "code", description: "note", isActive: "active" }
  },
  attendance: {
    entity: "attendance",
    lanaModel: "attendanceRecord",
    odooModel: "hr.attendance",
    keyField: "id",
    externalKeyField: "id",
    odooFields: ["id", "employee_id", "check_in", "check_out", "worked_hours", "create_date", "write_date"],
    fieldMap: { checkIn: "check_in", checkOut: "check_out" }
  },
  leave: {
    entity: "leave",
    lanaModel: "leaveRequest",
    odooModel: "hr.leave",
    keyField: "id",
    externalKeyField: "id",
    odooFields: ["id", "employee_id", "holiday_status_id", "request_date_from", "request_date_to", "number_of_days", "name", "state", "create_date", "write_date"],
    fieldMap: { startDate: "request_date_from", endDate: "request_date_to", days: "number_of_days", reason: "name", status: "state" }
  },
  contracts: {
    entity: "contracts",
    lanaModel: "employeeContract",
    odooModel: "hr.contract",
    keyField: "contractNumber",
    externalKeyField: "name",
    odooFields: ["id", "name", "employee_id", "job_id", "date_start", "date_end", "wage", "state", "create_date", "write_date"],
    fieldMap: { contractNumber: "name", title: "name", startDate: "date_start", endDate: "date_end", salaryAmount: "wage", status: "state" }
  },
  jobs: {
    entity: "jobs",
    lanaModel: "position",
    odooModel: "hr.job",
    keyField: "code",
    externalKeyField: "code",
    odooFields: ["id", "name", "code", "description", "department_id", "create_date", "write_date"],
    fieldMap: { title: "name", code: "code", description: "description" }
  },
  partners: {
    entity: "partners",
    lanaModel: "employee",
    odooModel: "res.partner",
    keyField: "email",
    externalKeyField: "email",
    odooFields: ["id", "name", "email", "phone", "mobile", "ref", "company_id", "create_date", "write_date"],
    fieldMap: { email: "email", phone: "phone", employeeNumber: "ref" }
  },
  companies: {
    entity: "companies",
    lanaModel: "branch",
    odooModel: "res.company",
    keyField: "code",
    externalKeyField: "name",
    odooFields: ["id", "name", "email", "phone", "street", "city", "country_id", "create_date", "write_date"],
    fieldMap: { name: "name", city: "city", country: "country_id" }
  },
  payroll: {
    entity: "payroll",
    lanaModel: "payrollItem",
    odooModel: "hr.payslip",
    keyField: "id",
    externalKeyField: "id",
    odooFields: ["id", "number", "name", "employee_id", "date_from", "date_to", "state", "create_date", "write_date"],
    fieldMap: { netPay: "net_wage", baseSalary: "basic_wage" }
  }
};

export function getMapper(entity: SyncEntity | string) {
  return ODOO_MAPPERS[entity];
}

export function asDateString(value: unknown, dateOnly = false) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return undefined;
  return dateOnly ? date.toISOString().slice(0, 10) : date.toISOString().replace("T", " ").slice(0, 19);
}

export function decimalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function many2oneId(value: unknown) {
  if (Array.isArray(value) && typeof value[0] === "number") return value[0];
  if (typeof value === "number") return value;
  return undefined;
}

export function many2oneName(value: unknown) {
  if (Array.isArray(value) && typeof value[1] === "string") return value[1];
  if (typeof value === "string") return value;
  return undefined;
}

export function splitFullName(fullName: unknown) {
  const value = typeof fullName === "string" && fullName.trim() ? fullName.trim() : "Odoo Employee";
  const [firstName, ...rest] = value.split(/\s+/);
  return { firstName, lastName: rest.join(" ") || " " };
}

export function mapLanaEmployeeToOdoo(employee: LanaEmployee): OdooWriteValues {
  const name = [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim();
  return stripEmpty({
    name: name || employee.employeeNumber,
    barcode: employee.employeeNumber,
    identification_id: employee.nationalId,
    work_email: employee.email,
    work_phone: employee.phone,
    mobile_phone: employee.phone,
    gender: normalizeGender(employee.gender),
    active: employee.status ? employee.status !== "TERMINATED" && employee.status !== "INACTIVE" : undefined
  });
}

export function mapOdooEmployeeToLana(record: OdooRecord): Record<string, unknown> {
  const names = splitFullName(record.name);
  return stripEmpty({
    employeeNumber: String(record.barcode || record.id || `ODOO-${record.id}`),
    nationalId: String(record.identification_id || `ODOO-${record.id}`),
    firstName: names.firstName,
    lastName: names.lastName,
    email: record.work_email || undefined,
    phone: record.work_phone || record.mobile_phone || undefined,
    gender: normalizeGender(record.gender),
    hireDate: asDateString(record.create_date, true) || new Date(),
    status: record.active === false ? "INACTIVE" : "ACTIVE"
  });
}

export function mapLanaDepartmentToOdoo(department: LanaDepartment): OdooWriteValues {
  return stripEmpty({ name: department.name, code: department.code, note: department.description, active: department.isActive });
}

export function mapOdooDepartmentToLana(record: OdooRecord): Record<string, unknown> {
  return stripEmpty({ name: record.name || `Odoo Department ${record.id}`, code: record.code || `ODOO-${record.id}`, description: record.note, isActive: record.active !== false });
}

export function mapLanaAttendanceToOdoo(attendance: LanaAttendance, odooEmployeeId?: number): OdooWriteValues {
  return stripEmpty({ employee_id: odooEmployeeId, check_in: asDateString(attendance.checkIn || attendance.workDate), check_out: asDateString(attendance.checkOut) });
}

export function mapOdooAttendanceToLana(record: OdooRecord, employeeId?: string): Record<string, unknown> {
  const checkIn = asDateString(record.check_in) || new Date();
  return stripEmpty({ employeeId, workDate: asDateString(checkIn, true), checkIn, checkOut: asDateString(record.check_out), status: "PRESENT" });
}

export function mapLanaLeaveToOdoo(leave: LanaLeave, odooEmployeeId?: number, leaveTypeId?: number): OdooWriteValues {
  return stripEmpty({
    employee_id: odooEmployeeId,
    holiday_status_id: leaveTypeId,
    request_date_from: asDateString(leave.startDate, true),
    request_date_to: asDateString(leave.endDate, true),
    number_of_days: decimalNumber(leave.days),
    name: leave.reason || "Lana leave request",
    state: mapLeaveStateToOdoo(leave.status)
  });
}

export function mapOdooLeaveToLana(record: OdooRecord, employeeId?: string, leaveTypeId?: string): Record<string, unknown> {
  return stripEmpty({
    employeeId,
    leaveTypeId,
    startDate: asDateString(record.request_date_from, true),
    endDate: asDateString(record.request_date_to, true),
    days: decimalNumber(record.number_of_days) ?? 1,
    reason: record.name,
    status: mapLeaveStateToLana(record.state)
  });
}

export function mapLanaContractToOdoo(contract: LanaContract, odooEmployeeId?: number): OdooWriteValues {
  return stripEmpty({
    name: contract.contractNumber || contract.title,
    employee_id: odooEmployeeId,
    date_start: asDateString(contract.startDate, true),
    date_end: asDateString(contract.endDate, true),
    wage: decimalNumber(contract.salaryAmount),
    state: mapContractStateToOdoo(contract.status)
  });
}

export function mapOdooContractToLana(record: OdooRecord, employeeId?: string): Record<string, unknown> {
  return stripEmpty({
    employeeId,
    contractNumber: record.name || `ODOO-${record.id}`,
    title: record.name || `Odoo Contract ${record.id}`,
    startDate: asDateString(record.date_start, true) || new Date(),
    endDate: asDateString(record.date_end, true),
    salaryAmount: decimalNumber(record.wage) ?? 0,
    currency: "USD",
    status: mapContractStateToLana(record.state)
  });
}

export function mapLanaJobToOdoo(position: { title: string; code?: string; description?: string | null }): OdooWriteValues {
  return stripEmpty({ name: position.title, code: position.code, description: position.description });
}

export function mapOdooJobToLana(record: OdooRecord): Record<string, unknown> {
  return stripEmpty({ title: record.name || `Odoo Job ${record.id}`, code: record.code || `ODOO-${record.id}`, description: record.description, isActive: true });
}

export function mapLanaPartnerToOdoo(employee: LanaEmployee): OdooWriteValues {
  const name = [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim();
  return stripEmpty({ name, email: employee.email, phone: employee.phone, mobile: employee.phone, ref: employee.employeeNumber });
}

export function mapLanaCompanyToOdoo(branch: { name: string; city?: string | null; country?: string | null; phone?: string | null; email?: string | null }): OdooWriteValues {
  return stripEmpty({ name: branch.name, city: branch.city, phone: branch.phone, email: branch.email });
}

export function mapLanaPayrollToOdoo(item: LanaPayrollItem, odooEmployeeId?: number): OdooWriteValues {
  const runName = item.payrollRun?.name || item.payrollRun?.period || "Lana Payroll";
  return stripEmpty({ name: runName, employee_id: odooEmployeeId, basic_wage: decimalNumber(item.baseSalary), net_wage: decimalNumber(item.netPay) });
}

export function detectConflicts(local: Record<string, unknown>, external: Record<string, unknown>, fields: Record<string, string>, context: { entity: string; localId?: string; externalId?: string }): SyncConflict[] {
  const conflicts: SyncConflict[] = [];
  for (const [localField, externalField] of Object.entries(fields)) {
    const localValue = normalizeComparable(local[localField]);
    const externalValue = normalizeComparable(external[externalField]);
    if (localValue !== undefined && externalValue !== undefined && localValue !== externalValue) {
      conflicts.push({ ...context, field: localField, localValue: local[localField], externalValue: external[externalField], reason: "Field values differ" });
    }
  }
  return conflicts;
}

export function stripEmpty<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== "")) as T;
}

function normalizeComparable(value: unknown) {
  if (value === null || value === undefined || value === false) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value.trim().toLowerCase();
  if (Array.isArray(value)) return normalizeComparable(value[0]);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function normalizeGender(value: unknown) {
  const gender = typeof value === "string" ? value.toLowerCase() : undefined;
  if (!gender) return undefined;
  if (["male", "m", "ذكر"].includes(gender)) return "male";
  if (["female", "f", "أنثى", "انثى"].includes(gender)) return "female";
  return gender;
}

function mapLeaveStateToOdoo(status: unknown) {
  switch (String(status || "").toUpperCase()) {
    case "APPROVED": return "validate";
    case "REJECTED": return "refuse";
    case "CANCELLED": return "cancel";
    case "DRAFT": return "draft";
    default: return "confirm";
  }
}

function mapLeaveStateToLana(status: unknown) {
  switch (String(status || "").toLowerCase()) {
    case "validate":
    case "validate1": return "APPROVED";
    case "refuse": return "REJECTED";
    case "cancel": return "CANCELLED";
    case "draft": return "DRAFT";
    default: return "PENDING";
  }
}

function mapContractStateToOdoo(status: unknown) {
  switch (String(status || "").toUpperCase()) {
    case "ACTIVE": return "open";
    case "TERMINATED": return "cancel";
    case "EXPIRED": return "close";
    default: return "draft";
  }
}

function mapContractStateToLana(status: unknown) {
  switch (String(status || "").toLowerCase()) {
    case "open": return "ACTIVE";
    case "close": return "EXPIRED";
    case "cancel": return "TERMINATED";
    default: return "DRAFT";
  }
}
