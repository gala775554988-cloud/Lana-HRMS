#!/usr/bin/env node
// Local ZKBio Time -> Lana HRMS attendance relay.
//
// Runs on a machine that stays on 24/7 inside the same LAN as the ZKBio Time
// server (this project's brief: 192.168.0.253). It never exposes anything to
// the internet -- it only makes OUTBOUND requests: one to ZKBio Time (LAN-only,
// http:// is fine because it never leaves the local network) and one to Lana
// HRMS on Vercel (HTTPS, with a secret bearer token).
//
// IMPORTANT: the JWT login endpoint and the transactions response shape below
// are the *documented* ZKBio Time convention, not yet verified against this
// project's actual ZKBio Time instance. Every parsing step below is defensive:
// if what comes back doesn't match what's expected, this script logs the
// actual shape it received (so you can tell Claude/a dev exactly what to fix)
// instead of silently dropping records or crashing.
//
// Zero npm dependencies -- only needs Node.js 18+ (for built-in fetch) installed.
// Setup instructions: see scripts/zkbio-attendance-sync.README.md

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, 'zkbio-attendance-sync.env');
const STATE_PATH = path.join(__dirname, 'zkbio-attendance-sync.state.json');

function loadEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const fileEnv = loadEnvFile(ENV_PATH);
function cfg(name, fallback) {
  return process.env[name] ?? fileEnv[name] ?? fallback;
}

const config = {
  zkbioUrl: (cfg('ZKBIO_URL', 'http://192.168.0.253:8081') || '').replace(/\/$/, ''),
  zkbioUsername: cfg('ZKBIO_USERNAME', ''),
  zkbioPassword: cfg('ZKBIO_PASSWORD', ''),
  zkbioLoginPath: cfg('ZKBIO_LOGIN_PATH', '/jwt-api-token-auth/'),
  zkbioTransactionsPath: cfg('ZKBIO_TRANSACTIONS_PATH', '/iclock/api/transactions/'),
  lanaUrl: (cfg('LANA_URL', 'https://lana-hrms.vercel.app') || '').replace(/\/$/, ''),
  zkbioSyncToken: cfg('ZKBIO_SYNC_TOKEN', ''),
  lookbackMinutesOnFirstRun: Number(cfg('LOOKBACK_MINUTES_FIRST_RUN', '120')),
};

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}
function warn(...args) {
  console.warn(new Date().toISOString(), 'WARNING:', ...args);
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { lastSyncedAt: null };
  }
}
function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function toZkbioTimestamp(date) {
  // Documented ZKBio Time convention: "YYYY-MM-DD HH:mm:ss". Adjust here if
  // your instance expects a different format once you've verified it.
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function getJwtToken() {
  if (!config.zkbioUsername || !config.zkbioPassword) {
    throw new Error('ZKBIO_USERNAME / ZKBIO_PASSWORD are not set in zkbio-attendance-sync.env');
  }
  const url = `${config.zkbioUrl}${config.zkbioLoginPath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: config.zkbioUsername, password: config.zkbioPassword }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`ZKBio Time login at ${url} did not return JSON (HTTP ${res.status}). Raw body (first 300 chars): ${text.slice(0, 300)}`);
  }
  if (!res.ok) {
    throw new Error(`ZKBio Time login failed: HTTP ${res.status} -- ${JSON.stringify(json)}`);
  }
  // Defensive: the documented field is "token", but different ZKBio Time
  // versions/configs have been seen using "access", "jwt", or "access_token".
  const token = json.token || json.access || json.jwt || json.access_token;
  if (!token) {
    warn(
      'Login succeeded but no known token field was found in the response. ' +
      `Top-level keys received: [${Object.keys(json).join(', ')}]. ` +
      'Report this back so ZKBIO_TOKEN_FIELD support can be added for your instance.'
    );
    throw new Error('Could not find a JWT token in the ZKBio Time login response -- see warning above for the actual keys received.');
  }
  return token;
}

function extractRecordsArray(json) {
  // Defensive: try the documented shape ({data: [...]})  first, then the two
  // other common Django-REST-Framework shapes, then fall back to "it's just
  // an array", and only give up (with a clear log of what we actually saw)
  // if none of those match.
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.results)) return json.results;
  if (Array.isArray(json?.data?.data)) return json.data.data;
  return null;
}

function extractField(row, candidates) {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return undefined;
}

async function fetchTransactions(token, startTime, endTime) {
  const url = new URL(`${config.zkbioUrl}${config.zkbioTransactionsPath}`);
  url.searchParams.set('start_time', toZkbioTimestamp(startTime));
  url.searchParams.set('end_time', toZkbioTimestamp(endTime));

  const res = await fetch(url, { headers: { Authorization: `JWT ${token}` } });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Transactions endpoint did not return JSON (HTTP ${res.status}). Raw body (first 300 chars): ${text.slice(0, 300)}`);
  }
  if (!res.ok) {
    throw new Error(`Transactions fetch failed: HTTP ${res.status} -- ${JSON.stringify(json).slice(0, 300)}`);
  }

  const rows = extractRecordsArray(json);
  if (rows === null) {
    warn(
      'Could not find a records array in the transactions response using any known shape ' +
      '(data / results / data.data / bare array). ' +
      `Top-level keys received: [${Object.keys(json).join(', ')}]. Full response (first 500 chars): ${JSON.stringify(json).slice(0, 500)}`
    );
    return [];
  }

  const records = [];
  for (const row of rows) {
    const empCode = extractField(row, ['emp_code', 'employee_code', 'emp_id', 'pin', 'badgenumber']);
    const punchTime = extractField(row, ['punch_time', 'punchTime', 'checktime', 'terminal_time']);
    if (empCode === undefined || punchTime === undefined) {
      warn(
        `Skipping one transaction row -- could not find emp_code/punch_time using known field names. ` +
        `Row keys: [${Object.keys(row).join(', ')}]. Row (first 300 chars): ${JSON.stringify(row).slice(0, 300)}`
      );
      continue;
    }
    records.push({ emp_code: String(empCode), punch_time: String(punchTime), raw: row });
  }
  return records;
}

async function sendToLana(records) {
  if (!config.zkbioSyncToken) throw new Error('ZKBIO_SYNC_TOKEN is not set in zkbio-attendance-sync.env');
  const res = await fetch(`${config.lanaUrl}/api/attendance/zkbio-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.zkbioSyncToken}` },
    body: JSON.stringify({ records }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Lana API ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  const state = loadState();
  const now = new Date();
  const startTime = state.lastSyncedAt
    ? new Date(state.lastSyncedAt)
    : new Date(now.getTime() - config.lookbackMinutesOnFirstRun * 60_000);

  log(`Polling ZKBio Time transactions from ${startTime.toISOString()} to ${now.toISOString()}...`);

  const token = await getJwtToken();
  const records = await fetchTransactions(token, startTime, now);

  if (!records.length) {
    log('No new transactions.');
  } else {
    const result = await sendToLana(records);
    log(`Sent ${records.length} record(s) to Lana. Response:`, JSON.stringify(result));
  }

  saveState({ lastSyncedAt: now.toISOString() });
}

main().catch((error) => {
  console.error(new Date().toISOString(), 'FATAL:', error.message || error);
  process.exitCode = 1;
});
