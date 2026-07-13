#!/usr/bin/env node
const baseUrl = (process.env.LOAD_TEST_URL || 'https://lana-hrms.vercel.app').replace(/\/$/, '');
const concurrency = Number(process.env.CONCURRENCY || 100);
const durationSeconds = Number(process.env.DURATION || 30);
const paths = (process.env.PATHS || '/login,/employees,/employee/dashboard,/integrations/synchronization').split(',');

const endAt = Date.now() + durationSeconds * 1000;
const results = [];
let total = 0;
let failed = 0;

async function hit(path) {
  const started = performance.now();
  try {
    const response = await fetch(baseUrl + path, { redirect: 'manual', cache: 'no-store' });
    const ms = performance.now() - started;
    results.push(ms);
    total += 1;
    if (response.status >= 500) failed += 1;
  } catch {
    failed += 1;
    total += 1;
  }
}

async function worker(index) {
  while (Date.now() < endAt) {
    const path = paths[index % paths.length];
    await hit(path);
    index += concurrency;
  }
}

await Promise.all(Array.from({ length: concurrency }, (_, index) => worker(index)));
results.sort((a, b) => a - b);
const pct = (p) => results[Math.min(results.length - 1, Math.floor(results.length * p))] || 0;
const summary = {
  baseUrl,
  concurrency,
  durationSeconds,
  paths,
  totalRequests: total,
  failed,
  rps: Number((total / durationSeconds).toFixed(2)),
  latencyMs: {
    p50: Math.round(pct(0.5)),
    p75: Math.round(pct(0.75)),
    p95: Math.round(pct(0.95)),
    p99: Math.round(pct(0.99)),
    max: Math.round(results.at(-1) || 0),
  },
};
console.log(JSON.stringify(summary, null, 2));
