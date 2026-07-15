export type OdooProtocol = "auto" | "json-rpc" | "xml-rpc";
export type ActiveOdooProtocol = Exclude<OdooProtocol, "auto">;

export type OdooModel =
  | "hr.employee"
  | "hr.department"
  | "hr.attendance"
  | "hr.leave"
  | "hr.contract"
  | "hr.job"
  | "hr.payslip"
  | "res.partner"
  | "res.company";

export type OdooDomainOperator =
  | "="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "like"
  | "ilike"
  | "not like"
  | "not ilike"
  | "in"
  | "not in"
  | "child_of";

export type OdooDomainLeaf = [string, OdooDomainOperator, unknown];
export type OdooDomain = Array<OdooDomainLeaf | "&" | "|" | "!">;
export type OdooRecord = Record<string, unknown> & { id?: number; write_date?: string | false; create_date?: string | false };
export type OdooFields = string[];

export type OdooConfig = {
  url: string;
  database: string;
  username: string;
  password: string;
  apiKey?: string;
  protocol?: OdooProtocol;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
};

export type RedactedOdooConfig = Omit<OdooConfig, "password" | "apiKey"> & {
  password?: "***";
  apiKey?: "***";
};

export type OdooAuthState = {
  uid: number;
  protocol: ActiveOdooProtocol;
  sessionId?: string;
  authenticatedAt: Date;
  expiresAt?: Date;
  serverVersion?: unknown;
};

export type OdooJsonRpcResponse<T> = {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: {
      name?: string;
      message?: string;
      debug?: string;
      arguments?: unknown[];
      exception_type?: string;
    } | unknown;
  };
};

export type OdooCallKwKwargs = Record<string, unknown> & {
  context?: Record<string, unknown>;
  fields?: string[];
  limit?: number;
  offset?: number;
  order?: string;
};

export type OdooSearchReadOptions = OdooCallKwKwargs & {
  fields?: string[];
};

export type OdooWriteValue = string | number | boolean | null | undefined | Date | unknown[] | Record<string, unknown>;
export type OdooWriteValues = Record<string, OdooWriteValue>;

export type SyncDirection = "LANA_TO_ODOO" | "ODOO_TO_LANA" | "BIDIRECTIONAL" | "HRMS_TO_ODOO" | "ODOO_TO_HRMS";
export type NormalizedSyncDirection = "LANA_TO_ODOO" | "ODOO_TO_LANA" | "BIDIRECTIONAL";

export type SyncEntity = "employees" | "departments" | "attendance" | "leave" | "payroll" | "contracts" | "jobs" | "partners" | "companies";

export type SyncOptions = {
  connectionId?: string;
  mappingId?: string;
  entity?: SyncEntity | "all";
  direction?: SyncDirection;
  dryRun?: boolean;
  batchSize?: number;
  incremental?: boolean;
  since?: Date | string;
  limit?: number;
  tenantId?: string;
  mode?: "ID_FIRST" | "FULL" | "SINGLE_DETAIL";
  queueDetails?: boolean;
  employeeIds?: number[];
};

export type SyncOperation = "create" | "update" | "delete" | "skip" | "conflict";

export type DryRunOperation = {
  operation: SyncOperation;
  model: OdooModel | string;
  localId?: string;
  externalId?: number | string;
  values?: Record<string, unknown>;
  reason?: string;
};

export type SyncConflict = {
  entity: string;
  field?: string;
  localId?: string;
  externalId?: string;
  localValue?: unknown;
  externalValue?: unknown;
  reason: string;
};

export type SyncResult = {
  success: boolean;
  entity: string;
  direction: NormalizedSyncDirection;
  dryRun: boolean;
  pulled: number;
  pushed: number;
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  conflicts: number;
  cursor?: string;
  tenantId?: string;
  operations: DryRunOperation[];
  errors: Array<{ id?: string; message: string; details?: unknown }>;
};

export type LanaEmployee = {
  id?: string;
  employeeNumber: string;
  nationalId?: string;
  firstName: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  hireDate?: Date | string;
  terminationDate?: Date | string | null;
  status?: string;
  department?: { name?: string | null; code?: string | null } | null;
  position?: { title?: string | null; code?: string | null } | null;
  updatedAt?: Date | string;
};

export type LanaDepartment = {
  id?: string;
  name: string;
  code: string;
  description?: string | null;
  isActive?: boolean;
  updatedAt?: Date | string;
};

export type LanaAttendance = {
  id?: string;
  employeeId?: string;
  employee?: LanaEmployee | null;
  workDate: Date | string;
  checkIn?: Date | string | null;
  checkOut?: Date | string | null;
  status?: string;
  notes?: string | null;
  updatedAt?: Date | string;
};

export type LanaLeave = {
  id?: string;
  employeeId?: string;
  employee?: LanaEmployee | null;
  leaveTypeId?: string;
  leaveType?: { name?: string | null; code?: string | null } | null;
  startDate: Date | string;
  endDate: Date | string;
  days?: number | string;
  reason?: string | null;
  status?: string;
  updatedAt?: Date | string;
};

export type LanaContract = {
  id?: string;
  employee?: LanaEmployee | null;
  contractNumber: string;
  title: string;
  startDate: Date | string;
  endDate?: Date | string | null;
  salaryAmount?: number | string;
  currency?: string;
  status?: string;
  updatedAt?: Date | string;
};

export type LanaPayrollItem = {
  id?: string;
  employee?: LanaEmployee | null;
  payrollRun?: { name?: string | null; period?: string | null } | null;
  baseSalary?: number | string;
  allowanceTotal?: number | string;
  deductionTotal?: number | string;
  overtimeTotal?: number | string;
  netPay?: number | string;
  currency?: string;
  updatedAt?: Date | string;
};

export type MapperDefinition = {
  entity: SyncEntity;
  lanaModel: string;
  odooModel: OdooModel | string;
  keyField: string;
  externalKeyField: string;
  odooFields: string[];
  fieldMap: Record<string, string>;
};
