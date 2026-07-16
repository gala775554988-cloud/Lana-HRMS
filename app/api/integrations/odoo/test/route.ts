import { NextRequest, NextResponse } from "next/server";
import { getOdooEnvConfig } from "@/lib/integrations/odoo/config";
import { encodeXmlRpcCall } from "@/lib/integrations/odoo/auth";
import { OdooSyncService, requireOdooIntegrationAccess } from "@/lib/integrations/odoo/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  return 500;
}

function classifyRpcFailure(input: { status?: number; raw?: string; error?: string; uidFalse?: boolean }) {
  const text = `${input.status ?? ""} ${input.error ?? ""} ${input.raw ?? ""}`.toLowerCase();
  if (input.uidFalse) return "authentication rejected";
  if (/database.*(not.*found|does.*not.*exist|invalid)|db.*(not.*found|does.*not.*exist|invalid)|no such database/.test(text)) return "invalid database";
  if (/password|invalid login|wrong login/.test(text)) return "invalid password";
  if (/user.*(not.*found|does.*not.*exist|invalid)|login.*(not.*found|does.*not.*exist|invalid)/.test(text)) return "invalid username";
  if (/access denied|authentication failed|authenticate|unauthorized|forbidden|login/.test(text)) return "authentication rejected";
  if (input.status === 404 || /not found|endpoint/.test(text)) return "RPC endpoint unavailable";
  if (/network|fetch failed|econnrefused|enotfound|eai_again|socket/.test(text)) return "network";
  if (/timeout|aborted|timed out/.test(text)) return "timeout";
  return "other";
}

async function runRpcAuthDiagnostics() {
  const config = getOdooEnvConfig();
  const password = config.apiKey || config.password;
  const baseUrl = config.url.replace(/\/+$/, "");
  const jsonEndpoint = `${baseUrl}/web/session/authenticate`;
  const xmlEndpoint = `${baseUrl}/xmlrpc/2/common`;
  const startedAt = new Date().toISOString();

  const jsonRequest = {
    jsonrpc: "2.0",
    method: "call",
    params: { db: config.database, login: config.username, password },
    id: 1
  };
  const redactedJsonRequest = {
    ...jsonRequest,
    params: { ...jsonRequest.params, password: "***" }
  };

  const diagnostics: Record<string, unknown> = {
    startedAt,
    database: config.database,
    username: config.username,
    attemptedProtocols: ["json-rpc", "xml-rpc"],
    attempts: []
  };
  const attempts = diagnostics.attempts as Array<Record<string, unknown>>;

  let jsonSucceeded = false;
  try {
    const response = await fetch(jsonEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jsonRequest),
      cache: "no-store"
    });
    const raw = await response.text();
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch {}
    const uid = parsed?.result?.uid;
    jsonSucceeded = response.ok && typeof uid === "number" && uid > 0;
    attempts.push({
      protocol: "json-rpc",
      endpoint: jsonEndpoint,
      request: redactedJsonRequest,
      httpStatus: response.status,
      responseHeaders: { contentType: response.headers.get("content-type") },
      rawResponse: raw,
      parsedResult: parsed ? { uid: parsed?.result?.uid ?? null, hasError: Boolean(parsed?.error), error: parsed?.error ?? null } : null,
      success: jsonSucceeded,
      failureType: jsonSucceeded ? null : classifyRpcFailure({ status: response.status, raw, uidFalse: parsed?.result?.uid === false || parsed?.result === false })
    });
    if (jsonSucceeded) return { ...diagnostics, selectedProtocol: "json-rpc", success: true, uid };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    attempts.push({
      protocol: "json-rpc",
      endpoint: jsonEndpoint,
      request: redactedJsonRequest,
      httpStatus: null,
      rawResponse: null,
      success: false,
      error: message,
      failureType: classifyRpcFailure({ error: message })
    });
  }

  const xmlRequest = encodeXmlRpcCall("authenticate", [config.database, config.username, password, {}]);
  const redactedXmlRequest = encodeXmlRpcCall("authenticate", [config.database, config.username, "***", {}]);
  try {
    const response = await fetch(xmlEndpoint, {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: xmlRequest,
      cache: "no-store"
    });
    const raw = await response.text();
    const hasFault = raw.includes("<fault>");
    const uidMatch = hasFault ? null : raw.match(/<(?:int|i4|i8)>(\d+)<\/(?:int|i4|i8)>/);
    const boolFalse = /<boolean>0<\/boolean>/.test(raw);
    const uid = uidMatch ? Number(uidMatch[1]) : null;
    const success = response.ok && !hasFault && typeof uid === "number" && uid > 0;
    attempts.push({
      protocol: "xml-rpc",
      endpoint: xmlEndpoint,
      request: redactedXmlRequest,
      httpStatus: response.status,
      responseHeaders: { contentType: response.headers.get("content-type") },
      rawResponse: raw,
      parsedResult: { uid, booleanFalse: boolFalse, hasFault },
      success,
      failureType: success ? null : classifyRpcFailure({ status: response.status, raw, uidFalse: boolFalse })
    });
    return { ...diagnostics, selectedProtocol: success ? "xml-rpc" : null, success, uid: success ? uid : null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    attempts.push({
      protocol: "xml-rpc",
      endpoint: xmlEndpoint,
      request: redactedXmlRequest,
      httpStatus: null,
      rawResponse: null,
      success: false,
      error: message,
      failureType: classifyRpcFailure({ error: message })
    });
    return { ...diagnostics, selectedProtocol: null, success: false, uid: null };
  }
}

async function listFields(connectionId: string | undefined, model: string, search: string, runSync = false) {
  const service = await OdooSyncService.forConnection(connectionId);
  const { discoverSyncableFields } = await import("@/lib/integrations/odoo/dynamic-fields");
  const { fieldNames, excludedBankFields, catalog } = await discoverSyncableFields(service.client, model);

  if (runSync && model === "hr.employee") {
    const syncRes = await service.syncEmployees({ batchSize: 500, direction: "ODOO_TO_LANA", mode: "FULL" });
    return { success: true, model, count: fieldNames.length, excludedBankFields, syncResult: syncRes };
  }

  const entries: Array<{ technicalName: string; string?: unknown; help?: unknown; [key: string]: unknown }> =
    Object.entries(catalog).map(([technicalName, meta]) => ({ technicalName, ...meta, isSensitiveBankField: excludedBankFields.includes(technicalName) }));
  const needle = search.trim().toLowerCase();
  const filtered = needle
    ? entries.filter((entry) =>
        entry.technicalName.toLowerCase().includes(needle) ||
        String(entry.string ?? "").toLowerCase().includes(needle) ||
        String(entry.help ?? "").toLowerCase().includes(needle)
      )
    : entries;
  return { success: true, model, count: filtered.length, totalFields: entries.length, excludedBankFields, fields: filtered };
}

export async function GET(request: NextRequest) {
  try {
    await requireOdooIntegrationAccess("manage");
    const connectionId = request.nextUrl.searchParams.get("connectionId") || undefined;
    const debugRpc = request.nextUrl.searchParams.get("debugRpc") === "true";
    if (debugRpc && !connectionId) return NextResponse.json(await runRpcAuthDiagnostics());
    const model = request.nextUrl.searchParams.get("fieldsModel");
    if (model) {
      const search = request.nextUrl.searchParams.get("search") || "";
      const runSync = request.nextUrl.searchParams.get("sync") === "true";
      return NextResponse.json(await listFields(connectionId, model, search, runSync));
    }
    const service = await OdooSyncService.forConnection(connectionId);
    return NextResponse.json(await service.testConnection());
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: statusFor(error) });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireOdooIntegrationAccess("manage");
    const body = await request.json().catch(() => ({}));
    if (body.debugRpc && !body.connectionId) return NextResponse.json(await runRpcAuthDiagnostics());
    const service = await OdooSyncService.forConnection(body.connectionId);
    return NextResponse.json(await service.testConnection());
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: statusFor(error) });
  }
}
