import { prisma } from "@/lib/prisma";

/**
 * Independent "clean slate" identity-only sync: re-verifies and refreshes
 * ONLY employeeNumber (Odoo barcode) and nationalId (Odoo identification_id)
 * for employees already linked to Odoo (matched by odooId). Deliberately
 * isolated from syncEmployees -- it never touches any other field, never
 * creates or deletes an Employee row, and can't affect the rest of the sync
 * pipeline's stability.
 */

export type OdooIdentityRecord = {
  id: number;
  barcode?: unknown;
  identification_id?: unknown;
};

export type IdentityValidation =
  | { valid: true; employeeNumber: string; nationalId: string }
  | { valid: false; reason: IdentitySkipReason };

export type IdentitySkipReason =
  | "MISSING_EMPLOYEE_NUMBER"
  | "MISSING_NATIONAL_ID"
  | "PLACEHOLDER_EMPLOYEE_NUMBER"
  | "PLACEHOLDER_NATIONAL_ID"
  | "INVALID_NATIONAL_ID_FORMAT"
  | "NO_LOCAL_EMPLOYEE_LINKED"
  | "DUPLICATE_CONFLICT";

// Saudi national ID / iqama: exactly 10 digits, starting with 1 (citizen) or
// 2 (resident) -- the standard format for this system's employee base.
const NATIONAL_ID_PATTERN = /^[12]\d{9}$/;
// The historical "we didn't actually have this field" fallback used elsewhere
// in this codebase (mapper.ts) when Odoo returns nothing -- a strict pass
// must treat this as absent, never as a real identifier.
const PLACEHOLDER_PATTERN = /^ODOO-\d+$/;

export function validateEmployeeIdentity(record: OdooIdentityRecord): IdentityValidation {
  const rawEmployeeNumber = record.barcode;
  const rawNationalId = record.identification_id;

  if (rawEmployeeNumber === null || rawEmployeeNumber === undefined || String(rawEmployeeNumber).trim() === "") {
    return { valid: false, reason: "MISSING_EMPLOYEE_NUMBER" };
  }
  if (rawNationalId === null || rawNationalId === undefined || String(rawNationalId).trim() === "") {
    return { valid: false, reason: "MISSING_NATIONAL_ID" };
  }

  const employeeNumber = String(rawEmployeeNumber).trim();
  const nationalId = String(rawNationalId).trim();

  if (PLACEHOLDER_PATTERN.test(employeeNumber)) return { valid: false, reason: "PLACEHOLDER_EMPLOYEE_NUMBER" };
  if (PLACEHOLDER_PATTERN.test(nationalId)) return { valid: false, reason: "PLACEHOLDER_NATIONAL_ID" };
  if (!NATIONAL_ID_PATTERN.test(nationalId)) return { valid: false, reason: "INVALID_NATIONAL_ID_FORMAT" };

  return { valid: true, employeeNumber, nationalId };
}

export type IdentitySyncOutcome = {
  processed: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: Array<{ odooId: number; localEmployeeId?: string; reason: string }>;
};

export async function syncEmployeeIdentitiesOnly(odooRecords: OdooIdentityRecord[]): Promise<IdentitySyncOutcome> {
  const outcome: IdentitySyncOutcome = { processed: 0, updated: 0, unchanged: 0, skipped: 0, errors: [] };

  for (const record of odooRecords) {
    outcome.processed += 1;
    try {
      const validation = validateEmployeeIdentity(record);
      if (!validation.valid) {
        outcome.skipped += 1;
        outcome.errors.push({ odooId: record.id, reason: validation.reason });
        continue; // ContinueOnError -- never throw inside the loop
      }

      const localEmployee = await prisma.employee.findUnique({
        where: { odooId: record.id },
        select: { id: true, employeeNumber: true, nationalId: true }
      });
      if (!localEmployee) {
        outcome.skipped += 1;
        outcome.errors.push({ odooId: record.id, reason: "NO_LOCAL_EMPLOYEE_LINKED" });
        continue;
      }

      if (localEmployee.employeeNumber === validation.employeeNumber && localEmployee.nationalId === validation.nationalId) {
        outcome.unchanged += 1;
        continue;
      }

      // Never overwrite a value already claimed by a DIFFERENT employee --
      // matches this project's existing "no data modification for
      // duplicates" convention (log and skip, don't touch either record).
      const conflict = await prisma.employee.findFirst({
        where: {
          id: { not: localEmployee.id },
          OR: [{ nationalId: validation.nationalId }, { employeeNumber: validation.employeeNumber }]
        },
        select: { id: true }
      });
      if (conflict) {
        outcome.skipped += 1;
        outcome.errors.push({ odooId: record.id, localEmployeeId: localEmployee.id, reason: "DUPLICATE_CONFLICT" });
        continue;
      }

      await prisma.employee.update({
        where: { id: localEmployee.id },
        data: { employeeNumber: validation.employeeNumber, nationalId: validation.nationalId }
      });
      outcome.updated += 1;
    } catch (err) {
      outcome.skipped += 1;
      outcome.errors.push({ odooId: record.id, reason: err instanceof Error ? err.message : String(err) });
      continue; // ContinueOnError
    }
  }

  return outcome;
}
