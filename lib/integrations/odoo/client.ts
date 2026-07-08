import { getOdooEnvConfig, normalizeOdooConfig, redactedOdooConfig } from "./config";
import { jsonRpc, OdooAuthClient, OdooAuthenticationError, OdooIntegrationError, OdooRpcRequestError, xmlRpc } from "./auth";
import type { ActiveOdooProtocol, OdooAuthState, OdooCallKwKwargs, OdooConfig, OdooDomain, OdooFields, OdooRecord, OdooSearchReadOptions, OdooWriteValues } from "./types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error: unknown) {
  if (error instanceof OdooAuthenticationError) return true;
  if (error instanceof OdooIntegrationError) return error.retryable;
  return true;
}

export class OdooClient {
  private readonly config: OdooConfig;
  private readonly auth: OdooAuthClient;

  constructor(config: OdooConfig) {
    this.config = normalizeOdooConfig(config);
    this.auth = new OdooAuthClient(this.config);
  }

  static fromEnv(overrides: Partial<OdooConfig> = {}) {
    return new OdooClient(getOdooEnvConfig(overrides));
  }

  get protocol(): ActiveOdooProtocol | undefined {
    return this.auth.protocol;
  }

  get uid() {
    return this.auth.uid;
  }

  get sessionId() {
    return this.auth.sessionId;
  }

  getConfig(redacted = true) {
    return redacted ? redactedOdooConfig(this.config) : this.config;
  }

  getAuthState() {
    return this.auth.authState;
  }

  async connect() {
    return this.auth.login(this.config.protocol ?? "auto");
  }

  async refreshSession(force = false) {
    return this.auth.refreshSession(force);
  }

  async version() {
    const state = await this.ensureAuthenticated();
    if (state.protocol === "json-rpc") {
      return this.withRetry(() => jsonRpc<Record<string, unknown>>(this.config, "/web/webclient/version_info", {}, { sessionId: state.sessionId }).then((response) => response.result));
    }
    return this.withRetry(() => xmlRpc<Record<string, unknown>>(this.config, "/xmlrpc/2/common", "version", []));
  }

  async execute_kw<T = unknown>(model: string, method: string, args: unknown[] = [], kwargs: OdooCallKwKwargs = {}) {
    return this.withRetry(async () => {
      const state = await this.ensureAuthenticated();
      if (state.protocol === "json-rpc") {
        const response = await jsonRpc<T>(this.config, "/web/dataset/call_kw", {
          model,
          method,
          args,
          kwargs
        }, { sessionId: state.sessionId });
        return response.result;
      }

      return xmlRpc<T>(this.config, "/xmlrpc/2/object", "execute_kw", [
        this.config.database,
        state.uid,
        this.config.apiKey || this.config.password,
        model,
        method,
        args,
        kwargs
      ]);
    });
  }

  async executeKw<T = unknown>(model: string, method: string, args: unknown[] = [], kwargs: OdooCallKwargs = {}) {
    return this.execute_kw<T>(model, method, args, kwargs);
  }

  async callKw<T = unknown>(model: string, method: string, args: unknown[] = [], kwargs: OdooCallKwargs = {}) {
    return this.execute_kw<T>(model, method, args, kwargs);
  }

  async search(model: string, domain: OdooDomain = [], kwargs: OdooCallKwargs = {}) {
    return this.execute_kw<number[]>(model, "search", [domain], kwargs);
  }

  async read<T extends OdooRecord = OdooRecord>(model: string, ids: number[], fields: OdooFields = [], kwargs: OdooCallKwargs = {}) {
    return this.execute_kw<T[]>(model, "read", [ids], { ...kwargs, ...(fields.length > 0 ? { fields } : {}) });
  }

  async search_read<T extends OdooRecord = OdooRecord>(model: string, domain: OdooDomain = [], fields: OdooFields = [], options: OdooSearchReadOptions = {}) {
    const kwargs = { ...options, ...(fields.length > 0 ? { fields } : {}) };
    return this.execute_kw<T[]>(model, "search_read", [domain], kwargs);
  }

  async searchRead<T extends OdooRecord = OdooRecord>(model: string, domain: OdooDomain = [], fields: OdooFields = [], options: OdooSearchReadOptions = {}) {
    return this.search_read<T>(model, domain, fields, options);
  }

  async create(model: string, values: OdooWriteValues) {
    return this.execute_kw<number>(model, "create", [values]);
  }

  async write(model: string, ids: number[], values: OdooWriteValues) {
    return this.execute_kw<boolean>(model, "write", [ids, values]);
  }

  async unlink(model: string, ids: number[]) {
    return this.execute_kw<boolean>(model, "unlink", [ids]);
  }

  async fieldsGet(model: string, fields: string[] = [], attributes: string[] = ["string", "type", "required", "readonly", "relation"]) {
    return this.execute_kw<Record<string, Record<string, unknown>>>(model, "fields_get", fields.length > 0 ? [fields] : [], { attributes });
  }

  private async ensureAuthenticated(): Promise<OdooAuthState> {
    return this.auth.refreshSession(false);
  }

  private async withRetry<T>(operation: () => Promise<T>) {
    const maxRetries = this.config.maxRetries ?? 3;
    const baseDelay = this.config.retryDelayMs ?? 500;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (error instanceof OdooAuthenticationError) await this.auth.refreshSession(true).catch(() => undefined);
        if (attempt >= maxRetries || !isRetryable(error)) break;
        await sleep(baseDelay * Math.pow(2, attempt));
      }
    }

    if (lastError instanceof OdooIntegrationError) throw lastError;
    throw new OdooRpcRequestError(lastError instanceof Error ? lastError.message : String(lastError), lastError, undefined, false);
  }
}

export type OdooCallKwargs = OdooCallKwKwargs;
export { OdooAuthenticationError, OdooConfigurationError, OdooIntegrationError, OdooProtocolDetectionError, OdooRpcRequestError } from "./auth";
