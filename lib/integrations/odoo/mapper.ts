import type { LanaAttendance, LanaContract, LanaDepartment, LanaEmployee, LanaLeave, LanaPayrollItem, MapperDefinition, OdooRecord, OdooWriteValues, SyncConflict, SyncEntity } from "./types";

function formatEmployeeCodeHelper(code?: string | number | null): string {
  if (code === undefined || code === null || code === "") return `ODOO-${Date.now()}`;
  return String(code).trim();
}

export const ODOO_MAPPERS: Record<string, MapperDefinition> = {
  employees: {
    entity: "employees",
    lanaModel: "employee",
    odooModel: "hr.employee",
    keyField: "employeeNumber",
    externalKeyField: "barcode",
    odooFields: [
      "id",
      "name",
      "barcode",
      "identification_id",
      "work_email",
      "work_phone",
      "mobile_phone",
      "gender",
      "active",
      "department_id",
      "job_id",
      "parent_id",
      "company_id",
      "image_1920",
      "first_contract_date",
      "birthday",
      "country_id",
      "address_home_id",
      "private_email",
      "private_phone",
      "emergency_contact",
      "emergency_phone",
      "work_location_id",
      "employee_type",
      "marital",
      "children",
      "place_of_birth",
      "country_of_birth",
      "passport_id",
      "permit_no",
      "visa_no",
      "visa_expire",
      "departure_date",
      "departure_description",
      "create_date",
      "write_date",
    ],
    fieldMap: {
      employeeNumber: "barcode",
      nationalId: "identification_id",
      email: "work_email",
      phone: "work_phone",
      gender: "gender",
      hireDate: "first_contract_date",
      dateOfBirth: "birthday",
      profilePhotoUrl: "image_1920",
      status: "active",
      departmentId: "department_id",
      positionId: "job_id",
      branchId: "company_id",
      emergencyContact: "emergency_contact",
      terminationDate: "departure_date",
      address: "address_home_id"
    }
  },
  departments: {
    entity: "departments",
    lanaModel: "department",
    odooModel: "hr.department",
    keyField: "code",
    externalKeyField: "name",
    odooFields: ["id", "name", "active", "create_date", "write_date"],
    fieldMap: { name: "name", isActive: "active" }
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
    externalKeyField: "name",
    odooFields: ["id", "name", "description", "department_id", "create_date", "write_date"],
    fieldMap: { title: "name", description: "description" }
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
  const date = asDate(value);
  if (!date) return undefined;
  return dateOnly ? date.toISOString().slice(0, 10) : date.toISOString().replace("T", " ").slice(0, 19);
}

export function asDate(value: unknown) {
  if (!value || value === false) return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  const normalized = String(value).includes("T") ? String(value) : String(value).replace(" ", "T");
  const date = new Date(normalized.length === 10 ? `${normalized}T00:00:00.000Z` : normalized.endsWith("Z") ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
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

export function mapLanaEmployeeToOdoo(employee: any): OdooWriteValues {
  const name = [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim();
  // profilePhotoUrl may be data URI – extract base64
  let image1920: string | undefined;
  if (typeof employee.profilePhotoUrl === "string" && employee.profilePhotoUrl.length > 0) {
    const match = employee.profilePhotoUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
    image1920 = match ? match[1] : employee.profilePhotoUrl;
  }
  return stripEmpty({
    name: name || employee.employeeNumber,
    barcode: employee.employeeNumber,
    identification_id: employee.nationalId,
    work_email: employee.email,
    work_phone: employee.phone,
    mobile_phone: employee.phone,
    gender: normalizeGender(employee.gender),
    active: employee.status ? employee.status !== "TERMINATED" && employee.status !== "INACTIVE" : undefined,
    birthday: asDateString(employee.dateOfBirth, true),
    emergency_contact: employee.emergencyContact,
    sponsor: employee.sponsor,
    // Relations are resolved in sync service via IDs, not here
    // department_id, job_id, company_id handled externally
    image_1920: image1920
  });
}

export function mapOdooEmployeeToLana(record: OdooRecord): Record<string, unknown> {
  const names = splitFullName(record.name);
  const workEmail = textValue(record.work_email) || textValue(record.private_email);
  const workPhone = textValue(record.work_phone) || textValue(record.mobile_phone) || textValue(record.private_phone);
  const imageRaw = textValue(record.image_1920);
  const profilePhotoUrl = imageRaw ? (imageRaw.startsWith("data:") ? imageRaw : `data:image/jpeg;base64,${imageRaw}`) : undefined;
  const hireDate = asDate(record.first_contract_date) || asDate(record.create_date) || new Date();
  const dateOfBirth = asDate(record.birthday);
  const terminationDate = asDate(record.departure_date);
  const emergencyContact = [textValue(record.emergency_contact), textValue(record.emergency_phone)].filter(Boolean).join(" - ") || undefined;

  // Extract many2one IDs for later resolution in sync service
  const departmentOdooId = many2oneId(record.department_id);
  const jobOdooId = many2oneId(record.job_id);
  const companyOdooId = many2oneId(record.company_id);
  const managerOdooId = many2oneId(record.parent_id);

  // Last active date & archived
  const departureDate = asDate(record.departure_date);
  const writeDate = asDate(record.write_date);
  const createDate = asDate(record.create_date);
  const lastActiveDate = departureDate || writeDate || createDate || undefined;
  const archivedAt = record.active === false ? (departureDate || writeDate || undefined) : undefined;
  const archiveReason = textValue(record.departure_description);

  // 1. National ID (Iqama / الهوية الوطنية)
  const nationalIdStr = String(record.identification_id || record.l10n_sa_iqama_number || record.national_id || record.registration_number || `ODOO-${record.id}`).trim();

  // 2. Employee Number (الرقم الوظيفي المعتمد من أودو)
  let rawEmpCode = record.barcode || record.employee_code || record.pin || record.x_studio_employee_number || record.x_employee_code;
  if (!rawEmpCode || rawEmpCode === nationalIdStr || String(rawEmpCode).length > 8) {
    if (record.registration_number && record.registration_number !== nationalIdStr && String(record.registration_number).length <= 8) {
      rawEmpCode = record.registration_number;
    } else {
      rawEmpCode = record.id;
    }
  }
  const formattedCode = formatEmployeeCodeHelper(rawEmpCode);

  return stripEmpty({
    employeeNumber: formattedCode,
    nationalId: nationalIdStr,
    firstName: names.firstName,
    lastName: names.lastName,
    email: workEmail,
    phone: workPhone,
    gender: normalizeGender(record.gender),
    hireDate,
    dateOfBirth,
    terminationDate,
    emergencyContact,
    profilePhotoUrl,
    address: undefined,
    // Real Odoo field names confirmed by the client: sponsor, sponsor_name,
    // sponsor_id can each independently hold the sponsor display value
    // depending on how their instance is configured -- prefer the most
    // specific/readable one available.
    sponsor: textValue(record.sponsor_name) || textValue(record.sponsor) || many2oneName(record.sponsor_id) || textValue(record.sponsor_id),
    analyticAccount: many2oneName(record.analytic_account) || textValue(record.analytic_account),
    status: record.active === false ? "INACTIVE" : "ACTIVE",
    lastActiveDate,
    lastActiveSource: record.active === false ? "ODOO_DEPARTURE" : "ODOO_WRITE_DATE",
    archivedAt,
    archiveReason,
    // Pass-through Odoo relation IDs for resolver
    odooDepartmentId: departmentOdooId,
    odooJobId: jobOdooId,
    odooCompanyId: companyOdooId,
    odooManagerId: managerOdooId,
    // "school" (real Odoo field name confirmed by the client) maps to our
    // Hospital directory. Resolved by name in the sync service since Hospital
    // has no Odoo-side id scheme of its own (unlike department/job/company).
    _hospitalName: many2oneName(record.school) || textValue(record.school),
    _odooId: record.id,
    _odooName: record.name
  });
}

export function mapLanaDepartmentToOdoo(department: LanaDepartment): OdooWriteValues {
  return stripEmpty({ name: department.name, code: department.code, note: department.description, active: department.isActive });
}

export function mapOdooDepartmentToLana(record: OdooRecord): Record<string, unknown> {
  return stripEmpty({ name: textValue(record.name) || `Odoo Department ${record.id}`, code: `ODOO-DEPT-${record.id}`, isActive: record.active !== false });
}

export function mapLanaAttendanceToOdoo(attendance: LanaAttendance, odooEmployeeId?: number): OdooWriteValues {
  return stripEmpty({ employee_id: odooEmployeeId, check_in: asDateString(attendance.checkIn || attendance.workDate), check_out: asDateString(attendance.checkOut) });
}

export function mapOdooAttendanceToLana(record: OdooRecord, employeeId?: string): Record<string, unknown> {
  const checkIn = asDate(record.check_in) || new Date();
  return stripEmpty({ employeeId, workDate: asDate(asDateString(checkIn, true)), checkIn, checkOut: asDate(record.check_out), status: "PRESENT" });
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
    startDate: asDate(record.request_date_from),
    endDate: asDate(record.request_date_to),
    days: decimalNumber(record.number_of_days) ?? 1,
    reason: textValue(record.name),
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
  return stripEmpty({ name: position.title, description: position.description });
}

export function mapOdooJobToLana(record: OdooRecord): Record<string, unknown> {
  return stripEmpty({ title: textValue(record.name) || `Odoo Job ${record.id}`, code: `ODOO-JOB-${record.id}`, description: textValue(record.description), isActive: true });
}

export function mapLanaPartnerToOdoo(employee: LanaEmployee): OdooWriteValues {
  const name = [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim();
  return stripEmpty({ name, email: employee.email, phone: employee.phone, mobile: employee.phone, ref: employee.employeeNumber });
}

export function mapLanaCompanyToOdoo(branch: { name: string; city?: string | null; country?: string | null; phone?: string | null; email?: string | null }): OdooWriteValues {
  return stripEmpty({ name: branch.name, city: branch.city, phone: branch.phone, email: branch.email });
}

export function mapOdooCompanyToLana(record: OdooRecord): Record<string, unknown> {
  return stripEmpty({
    name: textValue(record.name) || `Odoo Company ${record.id}`,
    code: `ODOO-COMPANY-${record.id}`,
    address: [textValue(record.street), textValue(record.street2)].filter(Boolean).join(" ") || undefined,
    city: textValue(record.city),
    country: many2oneName(record.country_id),
    isActive: true
  });
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
