import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';
import { z } from 'zod';
async function load(path, imports = {}, env = {}) {
  const context = vm.createContext({ Buffer, Date, Number, Set, AbortSignal, File, process: { env } });
  const source = await fs.readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
  const module = new vm.SourceTextModule(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText, { context });
  await module.link(async key => { const values = imports[key] || (key === 'node:crypto' ? crypto : {}); return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context }); });
  await module.evaluate(); return module.namespace;
}
test('application signatures expire, reject tampering and fail closed without secret', async () => {
  const subject = await load('lib/recruitment/application-token.ts', {}, { AUTH_SECRET: 'test-secret' });
  const now = Date.now(); const token = subject.applicationToken(now);
  assert.equal(subject.validApplicationToken(token, now + 3000), true);
  assert.equal(subject.validApplicationToken(token, now + 100), false);
  assert.equal(subject.validApplicationToken(token, now + 3600001), false);
  assert.equal(subject.validApplicationToken(token + 'a', now + 3000), false);
  assert.equal(subject.validApplicationToken(`${now}.${'أ'.repeat(64)}`, now + 3000), false);
  const missing = await load('lib/recruitment/application-token.ts');
  assert.equal(missing.applicationToken(), ''); assert.equal(missing.validApplicationToken(token, now + 3000), false);
});
async function application(form, { existing = false, open = true } = {}) {
  const rows = [];
  const tx = { $executeRaw: async () => {}, candidate: { count: async () => 0, findFirst: async () => existing ? { id: 'existing' } : null, create: async ({ data }) => { rows.push(data); } } };
  const subject = await load('app/api/careers/apply/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    zod: { z }, '@/lib/prisma': { prisma: { jobOpening: { findFirst: async () => open ? { id: 'job' } : null }, $transaction: fn => fn(tx) } },
    '@/lib/recruitment/application-token': { validApplicationToken: token => token === 'valid' }
  });
  return { result: await subject.POST({ headers: new Headers(), formData: async () => form }), rows };
}
function form() { const data = new FormData(); for (const [key, value] of Object.entries({ token: 'valid', firstName: 'Test', lastName: 'Applicant', email: 'TEST@example.com', phone: '0500000000', jobOpeningId: 'job' })) data.set(key, value); data.set('resume', new File(['%PDF-1.4 test'], 'cv.pdf', { type: 'application/pdf' })); return data; }
test('saves PDF privately, normalizes email, and deduplicates repeated applications', async () => {
  const first = await application(form()); assert.equal(first.result.status, 200); assert.equal(first.rows.length, 1); assert.equal(first.rows[0].email, 'test@example.com'); assert.match(first.rows[0].resumeUrl, /^data:application\/pdf;base64,/);
  const duplicate = await application(form(), { existing: true }); assert.equal(duplicate.rows.length, 0); assert.equal(duplicate.result.status, 200);
});
test('rejects invalid files, closed jobs and unsigned submissions without saving', async () => {
  const invalid = form(); invalid.set('resume', new File(['malicious content'], 'cv.pdf')); assert.equal((await application(invalid)).result.status, 400);
  assert.equal((await application(form(), { open: false })).result.status, 400);
  const unsigned = form(); unsigned.delete('token'); assert.equal((await application(unsigned)).rows.length, 0); assert.equal((await application(unsigned)).result.status, 400);
});
test('comparison requires recruitment access and never falls back to invented AI output', async () => {
  let audited = false;
  const imports = {
    zod: { z }, '@/lib/prisma': { prisma: { jobOpening: { findUnique: async () => ({ title: 'Engineer', description: 'Requires engineering experience' }) }, candidate: { findMany: async () => [{ id: 'a', resumeUrl: 'data:application/pdf;base64,AAAA' }, { id: 'b', resumeUrl: 'data:application/pdf;base64,AAAA' }] } } },
    '@/lib/rbac': { requirePermission: async () => ({ user: { id: 'reviewer' } }) },
    '@/lib/settings': { getGeminiApiKey: () => '', getGeminiModel: () => 'test' },
    '@/lib/audit': { writeAuditLog: async () => { audited = true; } }
  };
  const subject = await load('lib/recruitment/actions.ts', imports);
  assert.ok((await subject.compareCandidates({ ids: ['a', 'b'], jobId: 'job' })).error);
  assert.equal(audited, false);
  assert.ok((await subject.compareCandidates({ ids: ['a', 'a'], jobId: 'job' })).error);
  const denied = await load('lib/recruitment/actions.ts', { ...imports, '@/lib/rbac': { requirePermission: async () => { throw new Error('Forbidden'); } } });
  await assert.rejects(denied.compareCandidates({ ids: ['a', 'b'], jobId: 'job' }), /Forbidden/);
});
