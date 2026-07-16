import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

/**
 * Real, server-enforced per-field access control for the Employee record's
 * most sensitive fields. Scoped deliberately to this one model rather than a
 * system-wide field registry (see conversation) -- a genuinely enforced
 * control for the highest-value target beats a UI-only "hide the input"
 * treatment across every model, which would still leak the values in API
 * responses.
 *
 * Access is per VIEWER (the user whose capability is being configured), not
 * per target employee -- exactly like every other grant in this permissions
 * system: configure once for a staff member, and it applies whenever they
 * look at or edit ANY employee's record.
 */

export const SENSITIVE_EMPLOYEE_FIELDS = [
  "nationalId",
  "email",
  "phone",
  "profilePhotoUrl",
  "address",
  "emergencyContact",
  "dateOfBirth"
] as const;

export type SensitiveEmployeeField = (typeof SENSITIVE_EMPLOYEE_FIELDS)[number];
export type FieldAccessLevel = "VIEW" | "EDIT" | "HIDDEN";
export type EmployeeFieldAccessMap = Record<SensitiveEmployeeField, FieldAccessLevel>;

const STORE_KEY = "enterprise.employeeFieldAccess";
// No explicit grant on record = fully open, matching how the rest of this
// permission system behaves (an unconfigured user is not silently locked
// out of data they could already see before this feature existed).
const DEFAULT_ACCESS: FieldAccessLevel = "EDIT";

type Store = { version: 1; users: Record<string, Partial<EmployeeFieldAccessMap>> };

function normalizeStore(value: unknown): Store {
  if (!value || typeof value !== "object") return { version: 1, users: {} };
  const raw = value as { users?: Record<string, unknown> };
  const users: Store["users"] = {};
  for (const [userId, record] of Object.entries(raw.users ?? {})) {
    const entry: Partial<EmployeeFieldAccessMap> = {};
    for (const field of SENSITIVE_EMPLOYEE_FIELDS) {
      const level = (record as Record<string, unknown>)?.[field];
      if (level === "VIEW" || level === "EDIT" || level === "HIDDEN") entry[field] = level;
    }
    users[userId] = entry;
  }
  return { version: 1, users };
}

async function getStore(): Promise<Store> {
  const setting = await prisma.appSetting.findUnique({ where: { key: STORE_KEY } }).catch(() => null);
  return normalizeStore(setting?.value);
}

async function saveStore(store: Store) {
  return prisma.appSetting.upsert({
    where: { key: STORE_KEY },
    update: { value: store },
    create: { key: STORE_KEY, value: store, description: "Per-user field-level access (view/edit/hidden) for sensitive Employee fields" }
  });
}

export async function getEmployeeFieldAccessRaw(userId: string): Promise<Partial<EmployeeFieldAccessMap>> {
  const store = await getStore();
  return store.users[userId] ?? {};
}

/** Resolves the full access map for `userId`, defaulting any unconfigured
 * field to EDIT. SUPER_ADMIN always gets full EDIT access -- they're the
 * ones who configure this for everyone else, and can revise their own grant
 * at any time, so there's no safety benefit to letting them lock themselves
 * out by mistake. */
export async function getEmployeeFieldAccess(userId: string, roles: string[] = []): Promise<EmployeeFieldAccessMap> {
  const base = Object.fromEntries(SENSITIVE_EMPLOYEE_FIELDS.map((field) => [field, DEFAULT_ACCESS])) as EmployeeFieldAccessMap;
  if (roles.includes("SUPER_ADMIN")) return base;
  const raw = await getEmployeeFieldAccessRaw(userId);
  return { ...base, ...raw };
}

export async function setEmployeeFieldAccess(actorUserId: string, targetUserId: string, fields: Partial<EmployeeFieldAccessMap>) {
  const store = await getStore();
  const previous = store.users[targetUserId] ?? {};
  const next: Partial<EmployeeFieldAccessMap> = {};
  for (const field of SENSITIVE_EMPLOYEE_FIELDS) {
    const level = fields[field];
    if (level === "VIEW" || level === "EDIT" || level === "HIDDEN") next[field] = level;
  }
  store.users[targetUserId] = next;
  await saveStore(store);
  await writeAuditLog({
    actorUserId,
    action: "employee-field-access:update",
    entity: "userFieldAccess",
    entityId: targetUserId,
    metadata: { previous, next }
  });
  return next;
}

/** Removes any HIDDEN field from a plain employee-shaped record. Mutates a
 * shallow copy; never mutates the input. */
export function redactHiddenFields<T extends Record<string, unknown>>(record: T, access: EmployeeFieldAccessMap): T {
  const copy: Record<string, unknown> = { ...record };
  for (const field of SENSITIVE_EMPLOYEE_FIELDS) {
    if (access[field] === "HIDDEN" && field in copy) copy[field] = null;
  }
  return copy as T;
}

/** Strips any sensitive field from an update payload the caller isn't
 * allowed to EDIT (VIEW or HIDDEN both block writes). Returns which fields
 * were dropped so the caller can surface that back to the user/audit log. */
export function filterEditableFields(data: Record<string, unknown>, access: EmployeeFieldAccessMap): { data: Record<string, unknown>; blockedFields: string[] } {
  const filtered: Record<string, unknown> = { ...data };
  const blockedFields: string[] = [];
  for (const field of SENSITIVE_EMPLOYEE_FIELDS) {
    if (field in filtered && access[field] !== "EDIT") {
      delete filtered[field];
      blockedFields.push(field);
    }
  }
  return { data: filtered, blockedFields };
}
