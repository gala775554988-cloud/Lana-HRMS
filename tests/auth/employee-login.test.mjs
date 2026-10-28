import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';
import { z } from 'zod';

// Execute the real TypeScript modules with controlled database/provider adapters.
async function loadModule(file, prisma, extras = {}) {
  const source = await fs.readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
  const context = vm.createContext({ Buffer, Date, URLSearchParams, AbortSignal, process: { env: extras.env ?? {} }, fetch: extras.fetch });
  const subject = new vm.SourceTextModule(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText, { context });
  await subject.link(async name => {
    const exports = extras.imports?.[name] ?? (name === '@/lib/prisma' ? { prisma } : name === 'node:crypto' ? { timingSafeEqual: crypto.timingSafeEqual, createHash: crypto.createHash, createHmac: crypto.createHmac, randomBytes: crypto.randomBytes, randomInt: crypto.randomInt } : { verifyPassword: async (password, hash) => password === hash });
    const dependency = new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context });
    return dependency;
  });
  await subject.evaluate();
  return subject.namespace;
}

function tokenStore() {
  const rows = new Map();
  return {
    rows,
    async create({ data }) { if (rows.has(data.token)) throw Object.assign(new Error('duplicate'), { code: 'P2002' }); rows.set(data.token, data); return data; },
    async findUnique({ where }) { return rows.get(where.token) ?? null; },
    async upsert({ where, create, update }) { rows.set(where.token, rows.has(where.token) ? { ...rows.get(where.token), ...update } : create); },
    async deleteMany({ where }) {
      let count = 0;
      for (const [key, row] of rows) {
        if (where.token && key !== where.token || where.identifier && row.identifier !== where.identifier) continue;
        if (where.expires?.lte && row.expires > where.expires.lte || where.expires?.gt && row.expires <= where.expires.gt) continue;
        rows.delete(key); count++;
      }
      return { count };
    },
  };
}
const email = 'employee@lana-company.sa';
const env = { RESEND_API_KEY: 'test-only', OTP_EMAIL_FROM: 'login@lana-company.sa', AUTH_SECRET: 'test-secret-not-for-production' };
function mailer() {
  const messages = [];
  return { messages, fetch: async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    const message = JSON.parse(options.body);
    messages.push(message);
    return { ok: true, json: async () => ({ id: 'email-id' }) };
  } };
}
function sentCode(sender) { return sender.messages.at(-1).text.match(/\b\d{6}\b/)[0]; }

test('employees use exactly four suffix digits; administrators keep their password', async () => {
  let role = 'EMPLOYEE';
  const subject = await loadModule('lib/auth/employee-login.ts', {
    employee: { findFirst: async () => ({ nationalId: '1234567890' }) },
    userRole: { findMany: async () => [{ role: { name: role } }] },
  });
  assert.equal((await subject.checkLoginPassword({ id: 'u', passwordHash: 'old' }, '7890')).valid, true);
  for (const bad of ['old', '890', '67890', '0000', '٧٨٩٠']) assert.equal((await subject.checkLoginPassword({ id: 'u', passwordHash: 'old' }, bad)).valid, false);
  assert.equal((await subject.checkLoginPassword({ id: 'u', passwordHash: 'custom-password', employeePasswordMode: 'CUSTOM' }, '7890')).valid, false);
  assert.equal((await subject.checkLoginPassword({ id: 'u', passwordHash: 'custom-password', employeePasswordMode: 'CUSTOM' }, 'custom-password')).valid, true);
  role = 'SUPER_ADMIN';
  assert.equal((await subject.checkLoginPassword({ id: 'u', passwordHash: 'strong-password' }, '7890')).valid, false);
  assert.equal((await subject.checkLoginPassword({ id: 'u', passwordHash: 'strong-password' }, 'strong-password')).valid, true);
});

test('email delivery fails closed without configuration and rejects placeholder addresses', async () => {
  const subject = await loadModule('lib/auth/employee-otp.ts', {});
  assert.equal(subject.normalizeEmployeeEmail(' EMPLOYEE@LANA-COMPANY.SA '), email);
  for (const value of ['not an email', 'admin@lana.local', 'user@example.com', 'user@test.invalid', 'a@b.sa\nBcc: other@b.sa']) assert.equal(subject.normalizeEmployeeEmail(value), null);
  await assert.rejects(subject.sendEmployeeOtp('u', email), /غير متاح/);
});

test('email codes are hashed, user/destination bound, expiring and atomically single-use', async () => {
  const store = tokenStore();
  const sender = mailer();
  const subject = await loadModule('lib/auth/employee-otp.ts', { verificationToken: store }, { env, fetch: sender.fetch });
  assert.equal(await subject.verifyEmployeeOtp('u', '', email), false);
  assert.equal(await subject.verifyEmployeeOtp('u', '123456', email), false);
  await subject.sendEmployeeOtp('u', email);
  const code = sentCode(sender);
  assert.equal(sender.messages[0].to[0], email);
  const pending = store.rows.get('employee-email-login:u:pending');
  const challenge = JSON.parse(pending.identifier);
  assert.equal(challenge.digest.length, 64);
  assert.equal(Object.hasOwn(challenge, 'code'), false);
  assert.equal(pending.identifier.includes(email), false);
  assert.equal(await subject.verifyEmployeeOtp('another-user', code, email), false);
  assert.equal(await subject.verifyEmployeeOtp('u', code, 'other@lana-company.sa'), false);
  pending.expires = new Date(Date.now() - 1);
  assert.equal(await subject.verifyEmployeeOtp('u', code, email), false);
  pending.expires = new Date(Date.now() + 60000);
  const results = await Promise.all([subject.verifyEmployeeOtp('u', code, email), subject.verifyEmployeeOtp('u', code, email)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await subject.verifyEmployeeOtp('u', code, email), false);
});

test('five wrong verification attempts exhaust the challenge even with a subsequent valid code', async () => {
  const store = tokenStore();
  const sender = mailer();
  const subject = await loadModule('lib/auth/employee-otp.ts', { verificationToken: store }, { env, fetch: sender.fetch });
  await subject.sendEmployeeOtp('u', email);
  const code = sentCode(sender);
  const wrong = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) assert.equal(await subject.verifyEmployeeOtp('u', wrong, email), false);
  assert.equal(await subject.verifyEmployeeOtp('u', code, email), false);
});

test('concurrent sends share a durable rate limit; provider failures never create a challenge', async () => {
  const store = tokenStore();
  const sender = mailer();
  const subject = await loadModule('lib/auth/employee-otp.ts', { verificationToken: store }, { env, fetch: sender.fetch });
  const results = await Promise.allSettled([subject.sendEmployeeOtp('u', email), subject.sendEmployeeOtp('u', email)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(sender.messages.length, 1);
  const failingStore = tokenStore();
  const failing = await loadModule('lib/auth/employee-otp.ts', { verificationToken: failingStore }, { env, fetch: async () => ({ ok: false }) });
  await assert.rejects(failing.sendEmployeeOtp('u', email));
  assert.equal(failingStore.rows.has('employee-email-login:u:pending'), false);
});

test('legacy shared device identifiers never query or bind accounts', async () => {
  const subject = await loadModule('lib/cache/device-cache.ts', {});
  assert.equal((await subject.verifyOrBindEmployeeDevice('a', 'shared-browser')).allowed, true);
  assert.equal((await subject.verifyOrBindEmployeeDevice('b', 'shared-browser')).allowed, true);
});

test('the Credentials provider itself rejects missing OTP and cannot be bypassed with a shared device UUID', async () => {
  let options;
  let accepted = false;
  const user = { id: 'u', username: '1234567890', passwordHash: 'old', isActive: true, mustChangePassword: true, passwordChanged: false };
  const prisma = {
    employee: { findFirst: async query => query.include ? { user } : { id: 'employee' } },
    user: { update: async () => ({}) },
    userRole: { findMany: async () => [{ role: { name: 'EMPLOYEE' } }] },
  };
  await loadModule('auth.ts', prisma, { imports: {
    'next-auth': { default: config => { options = config; return {}; } },
    'next-auth/providers/credentials': { default: config => config },
    '@auth/prisma-adapter': { PrismaAdapter: () => ({}) },
    '@/lib/password': { hashPassword: async () => 'hash' },
    '@/lib/validations/auth': { loginSchema: { safeParse: data => ({ success: true, data }) } },
    '@/lib/enterprise/permissions': { getCachedEffectivePermissions: async () => [], PERMISSION_TEMPLATES: { EMPLOYEE: [] } },
    '@/lib/auth/employee-login': { checkLoginPassword: async (_user, password) => ({ valid: password === '7890', employee: { email } }) },
    '@/lib/auth/employee-enrollment': { resolveEmployeeLoginEmail: async () => email, completeEmployeeEmailEnrollment: async () => {} },
    '@/lib/auth/employee-otp': { verifyEmployeeOtp: async (_userId, code, destination) => accepted && destination === email && code === '123456' },
  } });
  const authorize = options.providers[0].authorize;
  assert.equal(await authorize({ identifier: '1234567890', password: '7890', deviceId: 'shared-device' }), null);
  assert.equal(await authorize({ identifier: '1234567890', password: '7890', verificationCode: '111111' }), null);
  accepted = true;
  assert.equal(await authorize({ identifier: '1234567890', password: 'wrong', verificationCode: '123456' }), null);
  const result = await authorize({ identifier: '1234567890', password: '7890', verificationCode: '123456', deviceId: 'shared-device' });
  assert.equal(result.id, 'u');
  assert.equal(result.mustChangePassword, false);
});

test('first email needs a recorded HR address or a valid private employee-bound activation code', async () => {
  const store = tokenStore();
  const otp = await loadModule('lib/auth/employee-otp.ts', {});
  const subject = await loadModule('lib/auth/employee-enrollment.ts', { verificationToken: store }, { imports: {
    '@/lib/auth/employee-otp': { normalizeEmployeeEmail: otp.normalizeEmployeeEmail },
  } });
  const user = { id: 'u', loginEmail: null };
  assert.equal(await subject.resolveEmployeeLoginEmail(user, null, email), null);
  assert.equal(await subject.resolveEmployeeLoginEmail(user, email, email), email);
  const code = 'a'.repeat(64);
  const token = subject.activationToken(code);
  store.rows.set(token, { token, identifier: 'employee-email-enrollment:another-user', expires: new Date(Date.now() + 60000) });
  assert.equal(await subject.resolveEmployeeLoginEmail(user, null, email, code), null);
  store.rows.get(token).identifier = 'employee-email-enrollment:u';
  store.rows.get(token).expires = new Date(Date.now() - 1);
  assert.equal(await subject.resolveEmployeeLoginEmail(user, null, email, code), null);
  store.rows.get(token).expires = new Date(Date.now() + 60000);
  assert.equal(await subject.resolveEmployeeLoginEmail(user, null, email, code), email);
  assert.equal(await subject.resolveEmployeeLoginEmail({ id: 'u', loginEmail: email }, null, 'attacker@other.sa', code), email);
  assert.equal(store.rows.has(token), true, 'resolving an address must not consume the invitation or save the email');
});

test('email enrollment commits after verification and refuses stale account versions', async () => {
  let count = 0;
  let consumed = 0;
  let update;
  const tx = {
    user: { updateMany: async query => { update = query; return { count }; } },
    verificationToken: { deleteMany: async () => { consumed++; } },
  };
  const subject = await loadModule('lib/auth/employee-enrollment.ts', { $transaction: async run => run(tx) }, { imports: {
    '@/lib/auth/employee-otp': { normalizeEmployeeEmail: value => value },
  } });
  await assert.rejects(subject.completeEmployeeEmailEnrollment({ id: 'u', loginEmail: null }, email, 3), /Account changed/);
  assert.equal(consumed, 0);
  count = 1;
  await subject.completeEmployeeEmailEnrollment({ id: 'u', loginEmail: null }, email, 3);
  assert.equal(update.where.sessionVersion, 3);
  assert.equal(update.where.isActive, true);
  assert.equal(update.data.loginEmail, email);
  assert.equal(consumed, 1);
});

test('only HR managers and super administrators manage accounts; HR cannot edit privileged or own accounts', async () => {
  const subject = await loadModule('lib/auth/account-management.ts', {});
  assert.equal(subject.canManageEmployeeAccounts(['EMPLOYEE']), false);
  assert.equal(subject.canManageEmployeeAccounts(['MANAGER']), false);
  assert.equal(subject.canEditEmployeeAccount(['HR_MANAGER'], ['EMPLOYEE'], 'hr', 'employee'), true);
  assert.equal(subject.canEditEmployeeAccount(['HR_MANAGER'], ['SUPER_ADMIN'], 'hr', 'admin'), false);
  assert.equal(subject.canEditEmployeeAccount(['SUPER_ADMIN'], ['SUPER_ADMIN'], 'admin', 'admin'), false);
});

test('account API enforces access and commits overrides, OTP invalidation and audit without credential values', async () => {
  const permissions = await loadModule('lib/auth/account-management.ts', {});
  let roles = ['EMPLOYEE'];
  let targetRoles = ['EMPLOYEE'];
  let calls = 0;
  let updated;
  let audit;
  let deleted;
  const tx = {
    employee: { findUnique: async () => ({ id: 'e', user: { id: 'target', loginEmail: null, roles: targetRoles.map(name => ({ role: { name } })) } }) },
    user: { update: async query => { updated = query.data; } },
    verificationToken: { deleteMany: async query => { deleted = query; }, create: async () => ({}) },
    auditLog: { create: async query => { audit = query.data; } },
  };
  const subject = await loadModule('app/api/employees/account/route.ts', { $transaction: async run => { calls++; return run(tx); } }, { imports: {
    '@/auth': { auth: async () => ({ user: { id: 'actor', roles } }) },
    'next/server': { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200 }) } },
    zod: { z },
    '@/lib/password': { hashPassword: async () => 'hashed-value', generateTemporaryPassword: () => 'generated-password' },
    '@/lib/auth/employee-enrollment': { activationToken: code => crypto.createHash('sha256').update(code).digest('hex') },
    '@/lib/auth/employee-otp': { normalizeEmployeeEmail: value => value.toLowerCase() },
    '@/lib/auth/account-management': { canManageEmployeeAccounts: permissions.canManageEmployeeAccounts, canEditEmployeeAccount: permissions.canEditEmployeeAccount },
  } });
  const request = body => ({ json: async () => body });
  assert.equal((await subject.PATCH(request({ employeeId: 'e', isActive: false }))).status, 403);
  assert.equal(calls, 0);
  roles = ['HR_MANAGER']; targetRoles = ['SUPER_ADMIN'];
  assert.equal((await subject.PATCH(request({ employeeId: 'e', isActive: false }))).status, 403);
  assert.equal(updated, undefined);
  targetRoles = ['EMPLOYEE'];
  const response = await subject.PATCH(request({ employeeId: 'e', email, password: 'new-password-123', isActive: false }));
  assert.equal(response.status, 200);
  assert.equal(updated.employeePasswordMode, 'CUSTOM');
  assert.equal(updated.passwordHash, 'hashed-value');
  assert.equal(updated.loginEmail, email);
  assert.equal(updated.loginEmailVerifiedAt, null);
  assert.equal(updated.isActive, false);
  assert.equal(updated.sessionVersion.increment, 1);
  assert.equal(deleted.where.OR[0].token, 'employee-email-login:target:pending');
  assert.equal(JSON.stringify(audit).includes('new-password-123'), false);
  assert.equal(JSON.stringify(audit).includes(email), false);
  const activation = await subject.PATCH(request({ employeeId: 'e', clearLoginEmail: true, issueActivation: true }));
  assert.equal(activation.data.activationCode.length, 64);
  assert.equal(updated.loginEmail, null);
  const invalid = await subject.PATCH(request({ employeeId: 'e', password: '123', restoreIdentityPassword: true }));
  assert.equal(invalid.status, 400);
});
