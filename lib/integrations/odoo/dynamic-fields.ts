import type { OdooClient } from "./client";

// Any field whose technical name, label, help text, or relation target matches
// these patterns is treated as banking data and is never requested from Odoo.
const BANK_NAME_PATTERN = /(bank|iban|swift|bic|routing|acc_number|account_number|sort_code)/i;
const BANK_RELATION_MODELS = new Set(["res.partner.bank"]);

export const SENSITIVE_FIELDS = [
  'bank_account_id',
  'x_studio_iban_number',
  'x_studio_swift_code',
  'x_studio_secondary_bank_name',
  'private_bank_account_id'
];

export type OdooFieldMeta = {
  string?: string;
  type?: string;
  relation?: string;
  help?: string;
  [key: string]: unknown;
};

function isBankField(technicalName: string, meta: OdooFieldMeta) {
  if (SENSITIVE_FIELDS.includes(technicalName)) return true;
  if (BANK_NAME_PATTERN.test(technicalName)) return true;
  if (meta.relation && BANK_RELATION_MODELS.has(String(meta.relation))) return true;
  if (BANK_NAME_PATTERN.test(String(meta.string ?? ""))) return true;
  if (BANK_NAME_PATTERN.test(String(meta.help ?? ""))) return true;
  return false;
}

/**
 * Discovers every field currently defined on an Odoo model (standard + custom/Studio fields)
 * and returns the subset that is safe to sync — i.e. everything except banking/payment fields.
 * Called fresh on each sync run so newly added Odoo fields are picked up automatically.
 */
export async function discoverSyncableFields(client: OdooClient, model: string) {
  const fields = await client.fieldsGet(model, [], ["string", "type", "required", "readonly", "relation", "help"]);
  const allNames: string[] = [];
  const excludedNames: string[] = [];
  for (const [technicalName, meta] of Object.entries(fields)) {
    if (isBankField(technicalName, meta as OdooFieldMeta)) {
      excludedNames.push(technicalName);
      continue;
    }
    allNames.push(technicalName);
  }
  return { fieldNames: allNames, excludedBankFields: excludedNames, catalog: fields as Record<string, OdooFieldMeta> };
}

export function sanitizeRawRecord(record: Record<string, unknown>, excludedNames: string[]) {
  const excluded = new Set([...excludedNames, ...SENSITIVE_FIELDS]);
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (excluded.has(key) || /(iban|swift|bank_account|sort_code)/i.test(key)) continue;
    clean[key] = value;
  }
  return clean;
}
