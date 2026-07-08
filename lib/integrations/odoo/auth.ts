import type { ActiveOdooProtocol, OdooAuthState, OdooConfig, OdooJsonRpcResponse } from "./types";

export type OdooErrorDetails = Record<string, unknown> | unknown;

export class OdooIntegrationError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly details?: OdooErrorDetails;
  readonly retryable: boolean;

  constructor(message: string, options: { code?: string; status?: number; details?: OdooErrorDetails; retryable?: boolean } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code ?? "ODOO_ERROR";
    this.status = options.status;
    this.details = options.details;
    this.retryable = options.retryable ?? false;
  }
}

export class OdooConfigurationError extends OdooIntegrationError {
  constructor(message: string, details?: OdooErrorDetails) {
    super(message, { code: "ODOO_CONFIGURATION_ERROR", details, retryable: false });
  }
}

export class OdooAuthenticationError extends OdooIntegrationError {
  constructor(message: string, details?: OdooErrorDetails) {
    super(message, { code: "ODOO_AUTHENTICATION_ERROR", status: 401, details, retryable: true });
  }
}

export class OdooRpcRequestError extends OdooIntegrationError {
  constructor(message: string, details?: OdooErrorDetails, status?: number, retryable = false) {
    super(message, { code: "ODOO_RPC_REQUEST_ERROR", status, details, retryable });
  }
}

export class OdooProtocolDetectionError extends OdooIntegrationError {
  constructor(message: string, details?: OdooErrorDetails) {
    super(message, { code: "ODOO_PROTOCOL_DETECTION_ERROR", details, retryable: false });
  }
}

export type JsonRpcRequestOptions = {
  sessionId?: string;
  timeoutMs?: number;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getOdooEndpoint(config: Pick<OdooConfig, "url">, path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimTrailingSlash(config.url)}${normalizedPath}`;
}

function normalizeAuthConfig(config: OdooConfig): OdooConfig {
  if (!config.url || !/^https?:\/\//i.test(config.url)) throw new OdooConfigurationError("ODOO_URL must be an absolute http(s) URL");
  if (!config.database) throw new OdooConfigurationError("ODOO_DATABASE is required");
  if (!config.username) throw new OdooConfigurationError("ODOO_USERNAME is required");
  if (!config.password && !config.apiKey) throw new OdooConfigurationError("ODOO_PASSWORD or ODOO_API_KEY is required");
  return {
    ...config,
    url: trimTrailingSlash(config.url),
    password: config.apiKey || config.password,
    protocol: config.protocol ?? "auto",
    timeoutMs: config.timeoutMs ?? 30_000,
    maxRetries: config.maxRetries ?? 3,
    retryDelayMs: config.retryDelayMs ?? 500
  };
}

let rpcCounter = 1;

export async function jsonRpc<T>(config: Pick<OdooConfig, "url" | "timeoutMs">, path: string, params: Record<string, unknown>, options: JsonRpcRequestOptions = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? config.timeoutMs ?? 30_000);
  try {
    const response = await fetch(getOdooEndpoint(config, path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(options.sessionId ? { Cookie: `session_id=${options.sessionId}` } : {})
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", params, id: rpcCounter++ }),
      cache: "no-store",
      signal: controller.signal
    });

    const setCookie = response.headers.get("set-cookie");
    const sessionId = setCookie?.match(/(?:^|;)\s*session_id=([^;]+)/)?.[1] ?? setCookie?.match(/session_id=([^;]+)/)?.[1];
    const payload = await response.json().catch(() => null) as OdooJsonRpcResponse<T> | null;

    if (!response.ok || !payload) {
      throw new OdooRpcRequestError(`Odoo JSON-RPC HTTP ${response.status}`, payload ?? undefined, response.status, response.status >= 500 || response.status === 429);
    }
    if (payload.error) {
      const errorData = payload.error.data as { name?: string; message?: string; exception_type?: string } | undefined;
      const message = errorData?.message || payload.error.message || "Odoo JSON-RPC error";
      if (payload.error.code === 100 || errorData?.name?.includes("SessionExpired") || /session|authentication|access denied/i.test(message)) {
        throw new OdooAuthenticationError(message, payload.error);
      }
      throw new OdooRpcRequestError(message, payload.error, undefined, /timeout|temporarily|deadlock|could not serialize/i.test(message));
    }

    return { result: payload.result as T, sessionId };
  } catch (error) {
    if (error instanceof OdooIntegrationError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new OdooRpcRequestError(`Odoo JSON-RPC request failed: ${message}`, { path }, undefined, true);
  } finally {
    clearTimeout(timeout);
  }
}

export function escapeXml(value: unknown) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function encodeXmlRpcValue(value: unknown): string {
  if (value === null || value === undefined) return "<value><nil/></value>";
  if (value instanceof Date) return `<value><dateTime.iso8601>${value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}</dateTime.iso8601></value>`;
  if (Array.isArray(value)) return `<value><array><data>${value.map(encodeXmlRpcValue).join("")}</data></array></value>`;
  if (typeof value === "object") {
    return `<value><struct>${Object.entries(value as Record<string, unknown>).map(([key, val]) => `<member><name>${escapeXml(key)}</name>${encodeXmlRpcValue(val)}</member>`).join("")}</struct></value>`;
  }
  if (typeof value === "boolean") return `<value><boolean>${value ? "1" : "0"}</boolean></value>`;
  if (typeof value === "number" && Number.isInteger(value)) return `<value><int>${value}</int></value>`;
  if (typeof value === "number") return `<value><double>${value}</double></value>`;
  return `<value><string>${escapeXml(value)}</string></value>`;
}

export function encodeXmlRpcCall(methodName: string, params: unknown[]) {
  return `<?xml version="1.0"?><methodCall><methodName>${escapeXml(methodName)}</methodName><params>${params.map((param) => `<param>${encodeXmlRpcValue(param)}</param>`).join("")}</params></methodCall>`;
}

type XmlNode = { name: string; children: XmlNode[]; text: string };

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseXml(xml: string): XmlNode {
  const root: XmlNode = { name: "root", children: [], text: "" };
  const stack: XmlNode[] = [root];
  const tokenRe = /<([^>]+)>|([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(xml))) {
    if (match[2]) {
      stack[stack.length - 1].text += decodeXmlEntities(match[2]);
      continue;
    }
    const raw = match[1].trim();
    if (!raw || raw.startsWith("?") || raw.startsWith("!")) continue;
    if (raw.startsWith("/")) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const selfClosing = raw.endsWith("/");
    const tag = raw.replace(/\/$/, "").split(/\s+/)[0];
    const node: XmlNode = { name: tag, children: [], text: "" };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
  }
  return root;
}

function child(node: XmlNode | undefined, name: string): XmlNode | undefined {
  return node?.children.find((item) => item.name === name);
}

function children(node: XmlNode | undefined, name: string): XmlNode[] {
  return node?.children.filter((item) => item.name === name) ?? [];
}

function text(node: XmlNode | undefined) {
  return (node?.text ?? "").trim();
}

function parseXmlRpcValue(valueNode: XmlNode | undefined): unknown {
  if (!valueNode) return undefined;
  const typedNode = valueNode.children[0];
  if (!typedNode) return text(valueNode);
  switch (typedNode.name) {
    case "int":
    case "i4":
    case "i8":
      return Number.parseInt(text(typedNode), 10);
    case "double":
      return Number.parseFloat(text(typedNode));
    case "boolean":
      return text(typedNode) === "1" || text(typedNode).toLowerCase() === "true";
    case "string":
      return typedNode.text;
    case "nil":
      return null;
    case "dateTime.iso8601":
      return text(typedNode);
    case "array":
      return children(child(typedNode, "data"), "value").map(parseXmlRpcValue);
    case "struct": {
      const result: Record<string, unknown> = {};
      for (const member of children(typedNode, "member")) {
        result[text(child(member, "name"))] = parseXmlRpcValue(child(member, "value"));
      }
      return result;
    }
    default:
      return text(typedNode) || parseXmlRpcValue(typedNode);
  }
}

export function decodeXmlRpcResponse<T>(xml: string): T {
  const parsed = parseXml(xml);
  const methodResponse = child(parsed, "methodResponse");
  const fault = child(methodResponse, "fault");
  if (fault) {
    const faultValue = parseXmlRpcValue(child(fault, "value"));
    const faultObject = faultValue as { faultString?: string; faultCode?: number };
    const message = faultObject?.faultString || "Odoo XML-RPC fault";
    if (/authentication|access denied|session|login/i.test(message)) throw new OdooAuthenticationError(message, faultObject);
    throw new OdooRpcRequestError(message, faultObject, undefined, /timeout|temporarily|deadlock/i.test(message));
  }
  const firstValue = child(child(child(methodResponse, "params"), "param"), "value");
  return parseXmlRpcValue(firstValue) as T;
}

export async function xmlRpc<T>(config: Pick<OdooConfig, "url" | "timeoutMs">, path: string, methodName: string, params: unknown[]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 30_000);
  try {
    const response = await fetch(getOdooEndpoint(config, path), {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: encodeXmlRpcCall(methodName, params),
      cache: "no-store",
      signal: controller.signal
    });
    const body = await response.text();
    if (!response.ok) {
      throw new OdooRpcRequestError(`Odoo XML-RPC HTTP ${response.status}`, { body }, response.status, response.status >= 500 || response.status === 429);
    }
    return decodeXmlRpcResponse<T>(body);
  } catch (error) {
    if (error instanceof OdooIntegrationError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new OdooRpcRequestError(`Odoo XML-RPC request failed: ${message}`, { path, methodName }, undefined, true);
  } finally {
    clearTimeout(timeout);
  }
}

export class OdooAuthClient {
  private readonly config: OdooConfig;
  private state?: OdooAuthState;

  constructor(config: OdooConfig) {
    this.config = normalizeAuthConfig(config);
  }

  get authState() {
    return this.state;
  }

  get uid() {
    return this.state?.uid;
  }

  get sessionId() {
    return this.state?.sessionId;
  }

  get protocol() {
    return this.state?.protocol;
  }

  clear() {
    this.state = undefined;
  }

  async login(preferredProtocol: ActiveOdooProtocol | "auto" = this.config.protocol ?? "auto") {
    const attempts: Array<ActiveOdooProtocol> = preferredProtocol === "auto"
      ? ["json-rpc", "xml-rpc"]
      : [preferredProtocol];
    const errors: Array<{ protocol: ActiveOdooProtocol; message: string }> = [];

    for (const protocol of attempts) {
      try {
        this.state = protocol === "json-rpc" ? await this.loginJsonRpc() : await this.loginXmlRpc();
        return this.state;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ protocol, message });
        if (preferredProtocol !== "auto") throw error;
      }
    }

    throw new OdooProtocolDetectionError("Unable to authenticate with Odoo using JSON-RPC or XML-RPC", { errors });
  }

  async refreshSession(force = false) {
    if (!force && this.state?.expiresAt && this.state.expiresAt.getTime() > Date.now() + 60_000) return this.state;
    return this.login(this.state?.protocol ?? this.config.protocol ?? "auto");
  }

  private async loginJsonRpc(): Promise<OdooAuthState> {
    const { result, sessionId } = await jsonRpc<{ uid?: number | false; session_id?: string; server_version_info?: unknown }>(this.config, "/web/session/authenticate", {
      db: this.config.database,
      login: this.config.username,
      password: this.config.apiKey || this.config.password
    });

    if (!result?.uid || typeof result.uid !== "number") {
      throw new OdooAuthenticationError("Odoo JSON-RPC authentication failed", result);
    }

    return {
      uid: result.uid,
      protocol: "json-rpc",
      sessionId: sessionId ?? result.session_id,
      authenticatedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60_000),
      serverVersion: result.server_version_info
    };
  }

  private async loginXmlRpc(): Promise<OdooAuthState> {
    const uid = await xmlRpc<number | false>(this.config, "/xmlrpc/2/common", "authenticate", [
      this.config.database,
      this.config.username,
      this.config.apiKey || this.config.password,
      {}
    ]);

    if (!uid || typeof uid !== "number") {
      throw new OdooAuthenticationError("Odoo XML-RPC authentication failed");
    }

    let serverVersion: unknown;
    try {
      serverVersion = await xmlRpc<unknown>(this.config, "/xmlrpc/2/common", "version", []);
    } catch {
      serverVersion = undefined;
    }

    return {
      uid,
      protocol: "xml-rpc",
      authenticatedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60_000),
      serverVersion
    };
  }
}
