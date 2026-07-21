import { prisma } from "@/lib/prisma";

/**
 * Authoritative Odoo Employee Number (الرقم الوظيفي) resolution engine.
 *
 * ROOT CAUSE OF THE SEQUENTIAL-ID BUG (numbers like 3311/3312/3313):
 * When the real Odoo employee-number field comes back empty, the old sync
 * fell back to `record.id` -- Odoo's internal auto-increment row id -- and
 * stored THAT as employeeNumber. Those are sequential internal ids, never
 * the real الرقم الوظيفي shown in Odoo.
 *
 * This module guarantees one deterministic source of truth:
 *   1. An administrator-configured / auto-detected authoritative field is
 *      persisted in AppSetting `odoo.employeeNumberField` (survives renders,
 *      cold starts, and all sync paths read it).
 *   2. Every resolution avoids Odoo `record.id` -- that value is NEVER a
 *      valid employee number. If no real identifier exists the resolver
 *      returns null and callers must use the explicit `ODOO-{id}` placeholder
 *      (which the reconciler later fixes once a true value appears in Odoo).
 */

// Ordered priority of Odoo hr.employee fields treated as "الرقم الوظيفي".
// The client's instance is Studio-customized, so x_* custom fields rank right
// after the canonical badge field.
export const EMPLOYEE_NUMBER_CANDIDATE_FIELDS: readonly string[] = [
  "barcode",                    // Odoo "Badge ID" -- the canonical الرقم الوظيفي
  "employee_code",
  "x_studio_employee_number",
  "x_studio_employee_code",
  "x_employee_number",
  "x_employee_code",
  "badge_number",
  "x_studio_badge_number",
  "x_studio_emp_no",
  "x_emp_no",
  "registration_number",
  "employee_no",
  "emp_number",
  "x_studio_id_number",
  "x_id_number",
  "pin"
];

// Extra auto-discovery: any custom/Studio field whose technical name hints at
// an employee number/code/id (never national/iqama/passport/visa identifiers).
const AUTO_DISCOVER_NAME_PATTERN = /^(x_.*(employee|emp|badge).*(number|code|no|id)|x_.*(number|code|no|id).*(employee|emp|badge))$/i;
const FORBIDDEN_IDENTIFIER_PATTERN = /(national|iqama|passport|visa|permit|resid|identification|border|civil)/i;

// Saudi national id / iqama: 10 digits starting with 1 or 2. A value shaped
// like this in a barcode field means the field actually holds the iqama and
// must never be used as الرقم الوظيفي.
const NATIONAL_ID_PATTERN = /^[12]\d{9}$/;

export function normalizeTextValue(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) {
    // many2one tuple [id, "Name"] -- an employee number never lives there
    return null;
  }
  const s = String(val).trim();
  if (!s || s === "false" || s === "null" || s === "None" || s === "0") return null;
  return s;
}

/**
 * Shape validation for an employee-number candidate value. Rejects the iqama
 * shape, values equal to the record's own identification_id, and anything
 * implausibly long.
 */
export function isValidEmployeeNumberValue(
  val: unknown,
  opts: { nationalId?: string | null; odooId?: number | null } = {}
): val is string {
  const s = normalizeTextValue(val);
  if (!s) return false;
  if (s.length > 16) return false;
  if (!/^[A-Za-z0-9][A-Za-z0-9.\-/]*$/.test(s)) return false;
  if (NATIONAL_ID_PATTERN.test(s)) return false;
  if (opts.nationalId && s === opts.nationalId) return false;
  if (opts.odooId && s === String(opts.odooId)) return false;
  return true;
}

export type EmployeeNumberResolution = {
  value: string;
  source: string; // technical field name that provided the value
};

/**
 * Resolve the authoritative employee number from a raw Odoo record.
 * Priority: persisted/known authoritative field first, then the static
 * candidate chain. NEVER falls back to record.id (the sequential-id bug).
 * Returns null when Odoo genuinely has no employee number for this record.
 */
export function resolveEmployeeNumberFromRecord(
  record: Record<string, unknown>,
  authoritativeField?: string | null
): EmployeeNumberResolution | null {
  const nationalId = normalizeTextValue(record.identification_id) || normalizeTextValue((record as any).nationalId);
  const odooId = typeof record.id === "number" ? record.id : Number(record.id) || null;
  const givens = { nationalId, odooId };

  const ordered = authoritativeField
    ? [authoritativeField, ...EMPLOYEE_NUMBER_CANDIDATE_FIELDS.filter((f) => f !== authoritativeField)]
    : EMPLOYEE_NUMBER_CANDIDATE_FIELDS;

  for (const field of ordered) {
    if (!field || FORBIDDEN_IDENTIFIER_PATTERN.test(field)) continue;
    const raw = (record as any)[field];
    if (isValidEmployeeNumberValue(raw, givens)) {
      return { value: normalizeTextValue(raw)!, source: field };
    }
  }
  return null;
}

export type DetectedEmployeeNumberField = {
  field: string;
  coverage: number;    // fraction of records with a usable value
  uniqueness: number;  // 1.0 == every filled value distinct
  validShape: number;  // fraction of filled values passing shape validation
  sample: string[];
};

/**
 * Statistical detection of the REAL employee-number field on this Odoo
 * instance across a fetched record set. Handles Studio instances where the
 * value lives in a custom x_* field nobody hard-coded for.
 */
export function detectAuthoritativeEmployeeNumberField(
  records: Array<Record<string, unknown>>,
  knownFieldNames?: string[]
): DetectedEmployeeNumberField | null {
  if (!records.length) return null;

  const names = new Set<string>([...EMPLOYEE_NUMBER_CANDIDATE_FIELDS]);
  if (knownFieldNames) {
    for (const f of knownFieldNames) {
      if (AUTO_DISCOVER_NAME_PATTERN.test(f) && !FORBIDDEN_IDENTIFIER_PATTERN.test(f)) names.add(f);
    }
  }
  // Also discover by what actually appears on records
  for (const r of records.slice(0, 500)) {
    for (const k of Object.keys(r)) {
      if (AUTO_DISCOVER_NAME_PATTERN.test(k) && !FORBIDDEN_IDENTIFIER_PATTERN.test(k)) names.add(k);
    }
  }

  const idIds = new Set(records.map((r) => String((r as any).identification_id ?? "").trim()).filter(Boolean));

  let best: DetectedEmployeeNumberField | null = null;
  let bestRank = -1;
  let bestCoverage = -1;

  for (const field of names) {
    let filled = 0;
    let valid = 0;
    const seen = new Map<string, number>();
    const dupes = new Set<string>();
    const sample: string[] = [];
    for (const r of records) {
      const nationalId = normalizeTextValue((r as any).identification_id);
      const odooId = typeof r.id === "number" ? r.id : Number(r.id) || null;
      const raw = (r as any)[field];
      const s = normalizeTextValue(raw);
      if (!s) continue;
      filled++;
      if (!isValidEmployeeNumberValue(raw, { nationalId, odooId })) continue;
      valid++;
      const c = (seen.get(s) ?? 0) + 1;
      seen.set(s, c);
      if (c > 1) dupes.add(s);
      if (sample.length < 3 && !sample.includes(s)) sample.push(s);
    }
    if (!filled) continue;
    const coverage = filled / records.length;
    const validShape = valid / filled;
    const uniqueness = valid ? 1 - dupes.size / valid : 0;

    // Hard gates: value must actually look like an employee number, appear in
    // at least half the population, be essentially unique, and never mirror
    // the identification_id column.
    if (validShape < 0.9 || coverage < 0.5 || uniqueness < 0.995) continue;
    let identityOverlap = 0;
    for (const v of seen.keys()) if (idIds.has(v)) identityOverlap++;
    if (identityOverlap > 0) continue;

    const rank = EMPLOYEE_NUMBER_CANDIDATE_FIELDS.indexOf(field);
    const rankBasis = rank === -1 ? 999 : rank;
    // Prefer canonical ordering; among equal rank, higher coverage wins.
    if (best === null || rankBasis < bestRank || (rankBasis === bestRank && coverage > bestCoverage)) {
      best = { field, coverage, uniqueness, validShape, sample };
      bestRank = rankBasis;
      bestCoverage = coverage;
    }
  }
  return best;
}

// ---------- Persisted authoritative field (AppSetting) with TTL cache ----------

const SETTING_KEY = "odoo.employeeNumberField";
const CACHE_TTL_MS = 60_000;
let cache: { field: string | null; at: number } | null = null;

export async function getConfiguredEmployeeNumberField(forceRefresh = false): Promise<string | null> {
  if (!forceRefresh && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.field;
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY }, select: { value: true } });
    let field: string | null = null;
    const value = row?.value as any;
    if (typeof value === "string") field = value.trim() || null;
    else if (value && typeof value.field === "string") field = value.field.trim() || null;
    if (field && !isValidFieldName(field)) field = null;
    cache = { field, at: Date.now() };
    return field;
  } catch {
    return cache?.field ?? null;
  }
}

export async function setConfiguredEmployeeNumberField(detected: DetectedEmployeeNumberField): Promise<void> {
  cache = { field: detected.field, at: Date.now() };
  try {
    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value: { field: detected.field, coverage: detected.coverage, uniqueness: detected.uniqueness, sample: detected.sample, detectedAt: new Date().toISOString() } as any },
      create: { key: SETTING_KEY, value: { field: detected.field, coverage: detected.coverage, uniqueness: detected.uniqueness, sample: detected.sample, detectedAt: new Date().toISOString() } as any, description: "حقل أودو المعتمد كمصدر رسمي للرقم الوظيفي (تم اكتشافه تلقائياً)" }
    });
  } catch {}
}

function isValidFieldName(field: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]{1,63}$/.test(field) && !FORBIDDEN_IDENTIFIER_PATTERN.test(field);
}

// ---------- Person-name matching helpers (Odoo record -> local employee) ----------

export function normalizePersonName(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  let s = String(raw).toLowerCase().trim();
  s = s.replace(/[\u064B-\u065F\u0670\u0640]/g, "");          // Arabic diacritics + tatweel
  s = s.replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\u0649/g, "ي");
  s = s.replace(/[^a-z0-9\u0600-\u06FF]+/g, " ").trim();
  return s.replace(/\s+/g, " ");
}

/** Order-insensitive key: "OMAR BAKHASH HUSSAIN" == "HUSSAIN OMAR BAKHASH" */
export function personNameTokenKey(raw: unknown): string {
  const n = normalizePersonName(raw);
  if (!n) return "";
  return n.split(" ").filter(Boolean).sort().join(" ");
}

/** Full local display name from split fields the same way the UI renders it. */
export function localEmployeeFullName(e: { firstName?: string | null; lastName?: string | null }): string {
  return `${e.firstName ?? ""} ${e.lastName ?? ""}`.replace(/\s+/g, " ").trim();
}
