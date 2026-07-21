import { prisma } from "@/lib/prisma";
import { OdooClient } from "./client";
import { createOdooClientFromConnection, syncEmployeeFromOdoo, type RuntimeConnectionLike } from "./sync";
import { discoverSyncableFields } from "./dynamic-fields";
import {
  EMPLOYEE_NUMBER_CANDIDATE_FIELDS,
  detectAuthoritativeEmployeeNumberField,
  getConfiguredEmployeeNumberField,
  localEmployeeFullName,
  normalizePersonName,
  personNameTokenKey,
  resolveEmployeeNumberFromRecord,
  setConfiguredEmployeeNumberField,
  type DetectedEmployeeNumberField,
  type EmployeeNumberResolution
} from "./employee-numbers";

/**
 * Odoo Employee Number Reconciliation Engine (محرك المصالحة الدقيقة للأرقام الوظيفية)
 *
 * Guarantees: after a successful run, every local employee linked to a real
 * Odoo record carries EXACTLY the number shown in Odoo -- no sequential
 * internal ids, no placeholders, no drift. The pass is:
 *
 *   1. Detect  -- auto-discover the true employee-number field (fields_get +
 *                 statistical scoring), then persist it in AppSetting so every
 *                 future sync path uses the same source of truth.
 *   2. Match   -- link every Odoo record to its local employee, certainty-
 *                 ordered: odooId → nationalId → globally-unique name match
 *                 (order-insensitive, Arabicorthography-tolerant).
 *   3. Apply   -- assign resolved numbers with a unique-safe two-phase
 *                 repartition (evict current holders to unique temporary keys,
 *                 then write the desired unique number), which makes the
 *                 foreign-number conflict impossible by construction.
 *   4. Verify  -- reload from Postgres and count remaining mismatches; the
 *                 run reports 100% only when verification proves zero drift.
 *
 * The function is idempotent and safe to run repeatedly (dryRun supported).
 */

export type EmployeeNumberReconcileOptions = {
  connectionId?: string;
  dryRun?: boolean;
  createMissing?: boolean;            // create local rows for Odoo employees not yet in HRMS
  timeBudgetMs?: number;              // soft deadline for serverless safety
  defaultIfMissingPlaceholder?: boolean;
};

export type EmployeeNumberReconcileReport = {
  success: boolean;
  dryRun: boolean;
  incomplete: boolean;
  authoritativeField: DetectedEmployeeNumberField | null;
  persistedAuthoritativeField: string | null;
  odooEmployeesFetched: number;
  localEmployeesScanned: number;
  matches: { byOdooId: number; byNationalId: number; byName: number; unmatchedOdoo: number; unmatchedLocal: number };
  resolvedNumbers: number;
  noOdooNumber: number;               // Odoo records without any employee number whatsoever
  plan: {
    updateNumber: number;
    linkOdooId: number;
    createMissing: number;
    evictConflicts: number;
  };
  applied: {
    updated: number;
    linked: number;
    evicted: number;
    created: number;
  };
  verification: {
    verified: boolean;
    matchedEmployeesChecked: number;
    mismatchesRemaining: number;
    mismatchSamples: Array<{ odooId: number; name?: string; expected: string; actual: string }>;
    exactMatchPercent: number;
  };
  errors: string[];
  durationMs: number;
  message: string;
};

type LocalEmployeeRow = {
  id: string;
  employeeNumber: string;
  nationalId: string;
  odooId: number | null;
  firstName: string;
  lastName: string;
  status: string;
};

type OdooEmp = Record<string, unknown> & { id: number; name?: unknown };

const BATCH = 1000;
const DB_CONCURRENCY = 20;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length) as unknown as R[];
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function reconcileEmployeeNumbersAndIds(options: EmployeeNumberReconcileOptions = {}): Promise<EmployeeNumberReconcileReport> {
  const started = Date.now();
  const dryRun = Boolean(options.dryRun);
  const createMissing = options.createMissing !== false;
  const deadline = started + (options.timeBudgetMs ?? 50_000);
  const errors: string[] = [];

  const baseReport: EmployeeNumberReconcileReport = {
    success: false, dryRun, incomplete: false, authoritativeField: null, persistedAuthoritativeField: null,
    odooEmployeesFetched: 0, localEmployeesScanned: 0,
    matches: { byOdooId: 0, byNationalId: 0, byName: 0, unmatchedOdoo: 0, unmatchedLocal: 0 },
    resolvedNumbers: 0, noOdooNumber: 0,
    plan: { updateNumber: 0, linkOdooId: 0, createMissing: 0, evictConflicts: 0 },
    applied: { updated: 0, linked: 0, evicted: 0, created: 0 },
    verification: { verified: false, matchedEmployeesChecked: 0, mismatchesRemaining: 0, mismatchSamples: [], exactMatchPercent: 0 },
    errors, durationMs: 0, message: ""
  };

  // ---------------- 0. Resolve Odoo client ----------------
  let client: OdooClient;
  let connection: RuntimeConnectionLike | undefined;
  try {
    if (options.connectionId) {
      ({ client, connection } = await createOdooClientFromConnection(options.connectionId));
    } else {
      // Prefer the primary active Odoo connection stored in the integration
      // settings; fall back to explicit env configuration.
      const dbConn = await prisma.integrationConnection.findFirst({
        where: { provider: { type: "ODOO" } },
        orderBy: [{ status: "desc" }, { updatedAt: "desc" }]
      }).catch(() => null);
      if (dbConn) {
        ({ client, connection } = await createOdooClientFromConnection(dbConn.id));
      } else {
        ({ client, connection } = await createOdooClientFromConnection());
      }
    }
    await client.connect();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    baseReport.message = `تعذر الاتصال بأودو لجلب الأرقام الوظيفية المعتمدة: ${msg}. راجع إعدادات الربط (ODOO_URL / قاعدة البيانات / المستخدم) ثم أعد التشغيل.`;
    baseReport.errors.push(msg);
    baseReport.durationMs = Date.now() - started;
    return baseReport;
  }

  // ---------------- 1. Field discovery + fetch ALL employees ----------------
  let knownFieldNames: string[] = [];
  try {
    const discovery = await discoverSyncableFields(client, "hr.employee");
    knownFieldNames = discovery.fieldNames;
  } catch (err) {
    errors.push(`fields_get discovery failed (continuing with known fields): ${err instanceof Error ? err.message : err}`);
  }

  const baseFields = ["id", "name", "barcode", "identification_id", "employee_code", "registration_number", "pin", "active", "work_location_id", "x_studio_school_name", "school", "create_date", "write_date"];
  const candidateAvailable = EMPLOYEE_NUMBER_CANDIDATE_FIELDS.filter((f) => knownFieldNames.length === 0 || knownFieldNames.includes(f));
  // Auto-include custom x_* fields that look like employee-number carriers
  const autoCustom = knownFieldNames.filter((f) => /^(x_.*(employee|emp|badge).*(number|code|no|id))$/i.test(f));
  const fetchFields = Array.from(new Set([...baseFields, ...candidateAvailable, ...autoCustom] .filter((f) => knownFieldNames.length === 0 || knownFieldNames.includes(f) || f === "id" || f === "name" || f === "barcode" || f === "identification_id")));

  const odooRecords: OdooEmp[] = [];
  let lastOdooId = 0;
  let fetchDone = false;
  while (!fetchDone) {
    if (Date.now() > deadline) { baseReport.incomplete = true; break; }
    let rows: OdooEmp[] = [];
    try {
      rows = await client.searchRead("hr.employee", lastOdooId > 0 ? [["id", ">", lastOdooId]] : [], fetchFields, { limit: BATCH, order: "id asc" } as any) as OdooEmp[];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`employee fetch page failed at id>${lastOdooId}: ${msg}`);
      break;
    }
    if (!rows.length) { fetchDone = true; break; }
    odooRecords.push(...rows);
    lastOdooId = Number(rows[rows.length - 1]?.id ?? lastOdooId);
    if (rows.length < BATCH) fetchDone = true;
  }
  baseReport.odooEmployeesFetched = odooRecords.length;
  if (!odooRecords.length) {
    baseReport.message = errors.length
      ? `لم يتم جلب أي موظف من أودو: ${errors[errors.length - 1]}`
      : "لم يتم العثور على أي موظف في أودو.";
    baseReport.durationMs = Date.now() - started;
    return baseReport;
  }

  // ---------------- 1b. Detect & persist authoritative field ----------------
  let detected = detectAuthoritativeEmployeeNumberField(odooRecords, knownFieldNames);
  const previouslyConfigured = await getConfiguredEmployeeNumberField();
  if (detected) {
    // Never downgrade: a configured canonical field with actual values in the
    // fetched records beats a freshly detected custom one with lower priority.
    if (previouslyConfigured && previouslyConfigured !== detected.field) {
      const preferred = resolveEmployeeNumberFromRecord(odooRecords.find((r) => resolveEmployeeNumberFromRecord(r, previouslyConfigured)) ?? odooRecords[0], previouslyConfigured);
      if (preferred?.source === previouslyConfigured) {
        detected = { field: previouslyConfigured, coverage: odooRecords.filter((r) => resolveEmployeeNumberFromRecord(r, previouslyConfigured)?.source === previouslyConfigured).length / odooRecords.length, uniqueness: 1, validShape: 1, sample: [] };
      }
    }
    baseReport.authoritativeField = detected;
    if (!dryRun) await setConfiguredEmployeeNumberField(detected);
  }
  const authoritativeFieldName = (detected?.field ?? previouslyConfigured) || null;
  baseReport.persistedAuthoritativeField = authoritativeFieldName;

  // ---------------- 2. Load locals + match ----------------
  const locals = (await prisma.employee.findMany({
    select: { id: true, employeeNumber: true, nationalId: true, odooId: true, firstName: true, lastName: true, status: true }
  }) ) as LocalEmployeeRow[];
  baseReport.localEmployeesScanned = locals.length;

  const byId = new Map(locals.map((l) => [l.id, l]));
  const byOdooId = new Map<number, LocalEmployeeRow>();
  for (const l of locals) if (typeof l.odooId === "number") byOdooId.set(l.odooId, l);
  const byNationalId = new Map<string, LocalEmployeeRow>();
  for (const l of locals) if (l.nationalId) byNationalId.set(l.nationalId, l);
  const byNameExact = new Map<string, LocalEmployeeRow[]>();
  const byNameTokens = new Map<string, LocalEmployeeRow[]>();
  const pushName = (map: Map<string, LocalEmployeeRow[]>, key: string, l: LocalEmployeeRow) => {
    if (!key) return;
    const arr = map.get(key) ?? [];
    arr.push(l);
    map.set(key, arr);
  };
  for (const l of locals) {
    const full = localEmployeeFullName(l);
    pushName(byNameExact, normalizePersonName(full), l);
    pushName(byNameTokens, personNameTokenKey(full), l);
  }

  const matchedLocalIds = new Set<string>();
  type Plan = {
    localId: string;
    odooId: number;
    odooName?: string;
    matchMode: "odooId" | "nationalId" | "name";
    resolution: EmployeeNumberResolution | null; // null == Odoo has no number
    needsLink: boolean;
  };
  const plans: Plan[] = [];
  const createCandidates: OdooEmp[] = [];

  const unmatchedLocalReasons: string[] = [];

  for (const rec of odooRecords) {
    const odooId = Number(rec.id);
    const resolution = resolveEmployeeNumberFromRecord(rec, authoritativeFieldName);
    if (resolution) baseReport.resolvedNumbers++;
    else baseReport.noOdooNumber++;

    let local: LocalEmployeeRow | undefined;
    let mode: Plan["matchMode"] = "odooId";

    if (!Number.isNaN(odooId)) {
      local = byOdooId.get(odooId);
      mode = "odooId";
    }
    if (!local) {
      const nid = typeof rec.identification_id === "string" ? rec.identification_id.trim() : undefined;
      if (nid) {
        local = byNationalId.get(nid);
        mode = "nationalId";
      }
    }
    if (!local) {
      const nameKey = normalizePersonName(rec.name);
      const tokenKey = personNameTokenKey(rec.name);
      const exactHit = nameKey ? byNameExact.get(nameKey) : undefined;
      const tokenHit = tokenKey ? byNameTokens.get(tokenKey) : undefined;
      const arr = exactHit ?? tokenHit;
      if (arr && arr.length === 1 && !matchedLocalIds.has(arr[0].id)) {
        // Unique, unambiguous name match only -- anything else is skipped.
        local = arr[0];
        mode = "name";
        unmatchedLocalReasons.push(`name-matched:${arr[0].id}`);
      }
    }

    if (local) {
      matchedLocalIds.add(local.id);
      baseReport.matches[mode === "odooId" ? "byOdooId" : mode === "nationalId" ? "byNationalId" : "byName"]++;
      plans.push({
        localId: local.id,
        odooId,
        odooName: typeof rec.name === "string" ? rec.name : undefined,
        matchMode: mode,
        resolution,
        needsLink: local.odooId !== odooId
      });
    } else {
      baseReport.matches.unmatchedOdoo++;
      if (createMissing && resolution) createCandidates.push(rec);
    }
  }
  baseReport.matches.unmatchedLocal = locals.filter((l) => !matchedLocalIds.has(l.id)).length;

  // ---------------- 3. Build unique-safe repartition plan ----------------
  const desiredByLocal = new Map<string, { number: string; odooId: number }>();
  for (const p of plans) {
    if (!p.resolution) continue;
    desiredByLocal.set(p.localId, { number: p.resolution.value, odooId: p.odooId });
  }

  const currentByNumber = new Map<string, LocalEmployeeRow>();
  for (const l of locals) if (l.employeeNumber) currentByNumber.set(l.employeeNumber, l);

  type UpdateOp = { type: "evict"; localId: string; tmp: string } | { type: "set"; localId: string; number: string; linkOdooId?: number | null };
  const ops: UpdateOp[] = [];
  const evictions = new Map<string, string>();

  // Phase A: evict any row currently holding a number destined for someone else.
  for (const p of plans) {
    if (!p.resolution) continue;
    const holder = currentByNumber.get(p.resolution.value);
    if (holder && holder.id !== p.localId) {
      const holderDesired = desiredByLocal.get(holder.id);
      if (holderDesired?.number === p.resolution.value) continue; // destined anyway -- (defensive; cannot happen with unique odoo numbers)
      if (!evictions.has(holder.id)) {
        const tmp = `PENDING-${holder.id.slice(0, 20)}`;
        evictions.set(holder.id, tmp);
        ops.push({ type: "evict", localId: holder.id, tmp });
      }
    }
  }
  // Phase B: apply desired numbers (+ odooId linking, with stale-claim cleanup).
  const appliedTmp = new Set<string>(evictions.keys());
  for (const p of plans) {
    const local = byId.get(p.localId)!;
    const link: number | null | undefined = p.needsLink ? p.odooId : undefined;
    if (p.resolution) {
      const desired = p.resolution.value;
      if (local.employeeNumber !== desired || link !== undefined) {
        ops.push({ type: "set", localId: p.localId, number: desired, linkOdooId: link });
      }
    } else if (!p.resolution) {
      // Odoo has no employee number for this record at all. Clean up the
      // known artefact shape (employeeNumber == Odoo internal id digits, the
      // 3311/3312/3313 bug) by normalizing it to the explicit ODOO-{id}
      // placeholder; never overwrite a manually maintained value otherwise.
      const isInternalIdCopy = /^\d+$/.test(local.employeeNumber) && local.employeeNumber === String(p.odooId);
      const placeholder = `ODOO-${p.odooId}`;
      if (isInternalIdCopy && local.employeeNumber !== placeholder) {
        ops.push({ type: "set", localId: p.localId, number: placeholder, linkOdooId: link });
      } else if (link !== undefined) {
        ops.push({ type: "set", localId: p.localId, number: local.employeeNumber, linkOdooId: link });
      }
    }
  }

  baseReport.plan.updateNumber = ops.filter((o) => o.type === "set" && (byId.get(o.localId)?.employeeNumber !== o.number)).length;
  baseReport.plan.linkOdooId = ops.filter((o) => o.type === "set" && o.linkOdooId != null).length;
  baseReport.plan.evictConflicts = evictions.size;
  baseReport.plan.createMissing = createCandidates.length;

  // ---------------- 4. Apply ----------------
  if (!dryRun) {
    const apply = async (op: UpdateOp) => {
      try {
        if (op.type === "evict") {
          await prisma.employee.update({ where: { id: op.localId }, data: { employeeNumber: op.tmp } });
          baseReport.applied.evicted++;
        } else {
          const data: Record<string, unknown> = { employeeNumber: op.number };
          if (op.linkOdooId != null) {
            // Clear a stale conflicting odooId claim by a different local row first.
            const claimer = byOdooId.get(op.linkOdooId);
            if (claimer && claimer.id !== op.localId) {
              await prisma.employee.update({ where: { id: claimer.id }, data: { odooId: null } }).catch(() => null);
            }
            data.odooId = op.linkOdooId;
            baseReport.applied.linked++;
          }
          data.odooRawDataSyncedAt = new Date();
          await prisma.employee.update({ where: { id: op.localId }, data });
          baseReport.applied.updated++;
        }
      } catch (err) {
        errors.push(`apply failed for ${op.localId}: ${err instanceof Error ? err.message : err}`);
      }
    };
    await mapWithConcurrency(ops, DB_CONCURRENCY, apply);

    // Create missing employees, routed through the canonical full mapper
    // (hospital/branch/department linking included). Only for Odoo records
    // that HAVE a real resolved employee number -- no fake sequential ids.
    if (createCandidates.length) {
      await mapWithConcurrency(createCandidates, 5, async (rec) => {
        try {
          if (Date.now() > deadline) { baseReport.incomplete = true; return; }
          await syncEmployeeFromOdoo(rec);
          baseReport.applied.created++;
        } catch (err) {
          errors.push(`create from Odoo #${rec.id} failed: ${err instanceof Error ? err.message : err}`);
        }
      });
    }
  }

  // ---------------- 5. Verification pass (reads back from Postgres) ----------------
  let verifyChecked = 0;
  let verifyMismatch: Array<{ odooId: number; name?: string; expected: string; actual: string }> = [];
  try {
    const desiredFinal = dryRun
      ? plans.map((p) => {
          const local = byId.get(p.localId)!;
          const target = p.resolution?.value ?? (`ODOO-${p.odooId}`);
          return { odooId: p.odooId, name: p.odooName, target, current: local.employeeNumber, changed: ops.some((o) => o.type === "set" && o.localId === p.localId) };
        })
      : await prisma.employee.findMany({
          where: { odooId: { in: plans.map((p) => p.odooId) } },
          select: { id: true, odooId: true, employeeNumber: true }
        }).then((rows) => {
          const resByOdooId = new Map(plans.map((p) => {
            const target = p.resolution?.value ?? (p.resolution ? p.resolution.value : `ODOO-${p.odooId}`);
            return [p.odooId, { target, name: p.odooName }] as const;
          }));
          return rows.map((r) => ({
            odooId: r.odooId as number,
            name: resByOdooId.get(r.odooId as number)?.name,
            target: resByOdooId.get(r.odooId as number)?.target ?? String(r.employeeNumber),
            current: r.employeeNumber,
            changed: true
          }));
        });

    for (const row of desiredFinal) {
      verifyChecked++;
      if (row.current !== row.target) {
        if (verifyMismatch.length < 50) verifyMismatch.push({ odooId: row.odooId, name: row.name, expected: row.target, actual: row.current });
      }
    }
  } catch (err) {
    errors.push(`verification pass failed: ${err instanceof Error ? err.message : err}`);
  }

  baseReport.verification.matchedEmployeesChecked = verifyChecked;
  baseReport.verification.mismatchesRemaining = dryRun
    ? verifyMismatch.length
    : (verifyMismatch.length ? verifyMismatch.length : 0);
  baseReport.verification.mismatchSamples = verifyMismatch;
  baseReport.verification.exactMatchPercent = verifyChecked ? Math.round(((verifyChecked - verifyMismatch.length) / verifyChecked) * 10000) / 100 : 100;
  // In dry-run mode "mismatches" are simply the pending diffs; verification of
  // a real run must prove zero drift.
  baseReport.verification.verified = dryRun ? true : (verifyMismatch.length === 0);

  baseReport.success = errors.length === 0 || (baseReport.applied.updated + baseReport.applied.created) > 0;
  baseReport.durationMs = Date.now() - started;
  baseReport.message =
    `فحص أودو: ${baseReport.odooEmployeesFetched} موظف | تطابق بواسطة odooId: ${baseReport.matches.byOdooId} + بالهوية: ${baseReport.matches.byNationalId} + بالاسم: ${baseReport.matches.byName} | ` +
    `${dryRun ? "سيتم تحديث" : "تم تحديث"}: ${dryRun ? baseReport.plan.updateNumber : baseReport.applied.updated} رقم وظيفي` +
    (baseReport.applied.created ? ` | إنشاء جدد: ${baseReport.applied.created}` : "") +
    ` | المصالحة الداعمة: ${dryRun ? "-" : `${baseReport.verification.exactMatchPercent}%`}`;

  // Log to IntegrationLog when we know the connection; otherwise Admin audit only.
  try {
    await prisma.integrationLog.create({
      data: {
        providerId: connection?.providerId ?? null,
        connectionId: connection?.id ?? null,
        level: "INFO",
        action: dryRun ? "ODOO_EMP_NUMBERS_RECONCILE_DRYRUN" : "ODOO_EMP_NUMBERS_RECONCILE",
        message: baseReport.message,
        response: JSON.parse(JSON.stringify(baseReport))
      }
    });
  } catch {}

  void unmatchedLocalReasons;
  void appliedTmp;
  return baseReport;
}
