import type { OdooConfig, OdooProtocol, RedactedOdooConfig } from "./types";
import { OdooConfigurationError } from "./auth";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 500;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function getOdooEnvConfig(overrides: Partial<OdooConfig> = {}): OdooConfig {
  const url = overrides.url ?? readEnv("ODOO_URL");
  const database = overrides.database ?? readEnv("ODOO_DATABASE");
  const username = overrides.username ?? readEnv("ODOO_USERNAME");
  const apiKey = overrides.apiKey ?? readEnv("ODOO_API_KEY");
  const password = overrides.password ?? apiKey ?? readEnv("ODOO_PASSWORD");
  const protocol = overrides.protocol ?? ((readEnv("ODOO_PROTOCOL") as OdooProtocol | undefined) || "auto");

  const missing = [
    ["ODOO_URL", url],
    ["ODOO_DATABASE", database],
    ["ODOO_USERNAME", username],
    [apiKey ? "ODOO_API_KEY" : "ODOO_PASSWORD", password]
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length > 0) {
    throw new OdooConfigurationError(`Missing Odoo configuration: ${missing.join(", ")}`, { missing });
  }

  return normalizeOdooConfig({
    url: url!,
    database: database!,
    username: username!,
    password: password!,
    apiKey,
    protocol,
    timeoutMs: overrides.timeoutMs,
    maxRetries: overrides.maxRetries,
    retryDelayMs: overrides.retryDelayMs
  });
}

export function normalizeOdooConfig(config: OdooConfig): OdooConfig {
  if (!config.url || !/^https?:\/\//i.test(config.url)) {
    throw new OdooConfigurationError("ODOO_URL must be an absolute http(s) URL");
  }
  if (!config.database) throw new OdooConfigurationError("ODOO_DATABASE is required");
  if (!config.username) throw new OdooConfigurationError("ODOO_USERNAME is required");
  if (!config.password && !config.apiKey) throw new OdooConfigurationError("ODOO_PASSWORD or ODOO_API_KEY is required");

  const protocol = config.protocol ?? "auto";
  if (!["auto", "json-rpc", "xml-rpc"].includes(protocol)) {
    throw new OdooConfigurationError("ODOO_PROTOCOL must be one of: auto, json-rpc, xml-rpc");
  }

  return {
    ...config,
    url: trimTrailingSlash(config.url),
    password: config.apiKey || config.password,
    protocol,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
    retryDelayMs: config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  };
}

export function redactedOdooConfig(config: OdooConfig): RedactedOdooConfig {
  return {
    ...config,
    password: config.password ? "***" : undefined,
    apiKey: config.apiKey ? "***" : undefined
  };
}

export function getOdooEndpoint(config: Pick<OdooConfig, "url">, path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimTrailingSlash(config.url)}${normalizedPath}`;
}
