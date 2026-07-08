export type OdooJsonRpcOptions = {
  baseUrl: string;
  database?: string | null;
  username?: string | null;
  password?: string | null;
  uid?: number | null;
  sessionId?: string | null;
};

type JsonRpcResponse<T> = { jsonrpc: string; id: number; result?: T; error?: { code: number; message: string; data?: unknown } };

export class OdooJsonRpcError extends Error {
  constructor(message: string, public payload?: unknown) {
    super(message);
    this.name = "OdooJsonRpcError";
  }
}

export class OdooJsonRpcClient {
  private id = 1;
  private sessionId?: string | null;

  constructor(private options: OdooJsonRpcOptions) {
    this.sessionId = options.sessionId;
  }

  private get baseUrl() {
    return this.options.baseUrl.replace(/\/$/, "");
  }

  private async rpc<T>(path: string, params: Record<string, unknown>) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.sessionId ? { Cookie: `session_id=${this.sessionId}` } : {})
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", params, id: this.id++ }),
      cache: "no-store"
    });
    const setCookie = response.headers.get("set-cookie");
    const sessionMatch = setCookie?.match(/session_id=([^;]+)/);
    if (sessionMatch?.[1]) this.sessionId = sessionMatch[1];
    const payload = await response.json().catch(() => null) as JsonRpcResponse<T> | null;
    if (!response.ok || !payload) throw new OdooJsonRpcError(`Odoo HTTP ${response.status}`, payload);
    if (payload.error) throw new OdooJsonRpcError(payload.error.message, payload.error);
    return payload.result as T;
  }

  async login(database: string, username: string, password: string) {
    const result = await this.rpc<{ uid: number; session_id?: string; server_version_info?: unknown }>("/web/session/authenticate", {
      db: database,
      login: username,
      password
    });
    return { ...result, sessionId: this.sessionId ?? result.session_id };
  }

  async authenticate(database = this.options.database || "", username = this.options.username || "", password = this.options.password || "") {
    const result = await this.login(database, username, password);
    this.options = { ...this.options, database, username, password, uid: result.uid, sessionId: result.sessionId };
    return result.uid;
  }

  getSession() {
    return { sessionId: this.sessionId, uid: this.options.uid, database: this.options.database };
  }

  async version() {
    return this.rpc<Record<string, unknown>>("/web/webclient/version_info", {});
  }

  async callKw<T = unknown>(model: string, method: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}) {
    return this.rpc<T>("/web/dataset/call_kw", {
      model,
      method,
      args,
      kwargs
    });
  }

  async execute<T = unknown>(model: string, method: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}) {
    return this.callKw<T>(model, method, args, kwargs);
  }

  async search(model: string, domain: unknown[] = [], kwargs: Record<string, unknown> = {}) {
    return this.callKw<number[]>(model, "search", [domain], kwargs);
  }

  async searchRead<T = Record<string, unknown>>(model: string, domain: unknown[] = [], fields: string[] = [], kwargs: Record<string, unknown> = {}) {
    return this.callKw<T[]>(model, "search_read", [domain], { fields, ...kwargs });
  }

  async create(model: string, values: Record<string, unknown>) {
    return this.callKw<number>(model, "create", [values]);
  }

  async write(model: string, ids: number[], values: Record<string, unknown>) {
    return this.callKw<boolean>(model, "write", [ids, values]);
  }

  async unlink(model: string, ids: number[]) {
    return this.callKw<boolean>(model, "unlink", [ids]);
  }
}
