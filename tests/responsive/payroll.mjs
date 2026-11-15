import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '../..');
const artifacts = process.env.PAYROLL_SCREENSHOTS || '/tmp/payroll-responsive';
await mkdir(artifacts, { recursive: true });
const bundle = await build({
  absWorkingDir: root, entryPoints: ['tests/responsive/payroll-fixture.tsx'], bundle: true,
  write: false, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'fixture-navigation', setup(builder) {
    builder.onResolve({ filter: /^next\/(navigation|link)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => args.path === 'next/link' ? { contents: `import React from 'react'; export default function Link(props){return React.createElement('a', props);}`, resolveDir: root } : { contents: `const params = new URLSearchParams('itemId=fixture'); export const useSearchParams=()=>params;` });
  } }],
});
const css = (await postcss([tailwindcss(path.join(root, 'tailwind.config.ts'))]).process(await readFile(path.join(root, 'app/globals.css'), 'utf8'), { from: path.join(root, 'app/globals.css') })).css;
const docSource = ts.transpileModule(await readFile(path.join(root, 'lib/payroll/document.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { payrollDocument } = await import(`data:text/javascript;base64,${Buffer.from(docSource).toString('base64')}`);
const documentHtml = payrollDocument({ title: 'تعريف الراتب وكشف المستحقات', company: 'شركة اختبار العرض', employee: 'موظف تجريبي باسم طويل لاختبار الالتفاف', number: 'TEST-001', period: '2026-11', currency: 'SAR', reference: 'TEST-' + '1234567890'.repeat(9), recipient: 'جهة تجريبية', qr: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120"/></svg>'), rows: [{ label: 'الراتب الأساسي', value: '10000.00 SAR' }, { label: 'رقم الحساب', value: 'SA' + '1'.repeat(24) }] });
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/bundle.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(bundle.outputFiles[0].text); }
  else if (url.pathname === '/styles.css') { response.setHeader('Content-Type', 'text/css'); response.end(css); }
  else { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(url.pathname === '/document' ? documentHtml : '<!doctype html><html lang="ar" dir="rtl"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"><body><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
  let rejectReport = false;
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const row = { id: 'fixture', source: 'ODOO', employeeName: 'موظف تجريبي باسم طويل لاختبار الالتفاف', employeeNumber: 'TEST-001', department: 'الإدارة المالية', period: '2026-11', status: 'PAID', currency: 'SAR', basic: '10000', gross: '12500', deductions: '1000', net: '11500' };
    let data;
    if (url.pathname.includes('/register/')) data = { employee: { firstName: 'موظف', lastName: 'تجريبي', employeeNumber: 'TEST-001' }, payslip: { period: '2026-11', currency: 'SAR', basic: '10000', gross: '12500', deductions: '1000', net: '11500' }, lines: [ { id: 'earning', name: 'الراتب الأساسي', code: 'BASIC', kind: 'BASIC', amount: '10000', quantity: '1', rate: '100', total: '10000' }, { id: 'deduction', name: 'قسط السلفة', code: 'ADV', kind: 'DEDUCTION', amount: '1000', quantity: '1', rate: '100', total: '1000' } ] };
    else if (url.pathname.endsWith('/compensation')) data = { policies: [], outbox: [] };
    else if (url.pathname.endsWith('/odoo')) data = { snapshots: [] };
    else if (url.pathname.includes('/payroll/run') || url.pathname.includes('/payroll/period') || url.pathname.includes('/branches') || url.pathname.includes('/departments')) data = { success: true, runs: [], periods: [], branches: [], departments: [], items: [], records: [] };
    else if (url.pathname.endsWith('/register')) data = { rows: [row], total: 41, periods: ['2026-11'], totals: [{ currency: 'SAR', employees: 1, gross: '12500', deductions: '1000', net: '11500' }], sync: null };
    else if (url.pathname.endsWith('/export')) data = rejectReport ? { success: false, message: 'تعذر تحميل التقرير التجريبي' } : { success: true, title: 'كشف الرواتب التفصيلي', rows: [{ الموظف: row.employeeName, الأساسي: 10000, البدلات: 2500, الاستقطاعات: 1000, الصافي: 11500, العملة: 'SAR', الفترة: '2026-11', القسم: row.department }] };
    else if (url.pathname.endsWith('/payslip')) data = { success: true, companyName: 'شركة اختبار العرض', item: { period: '2026-11', currency: 'SAR', baseSalary: 10000, allowanceTotal: 2500, grossPay: 12500, advanceDeduction: 1000, deductionTotal: 1000, netPay: 11500 }, employee: { name: row.employeeName, employeeNumber: 'TEST-001', iban: 'SA' + '1'.repeat(24), bank: 'بنك تجريبي' } };
    else if (url.pathname.endsWith('/history')) data = { items: [{ id: 'fixture', fromDate: '2026-11-01', net: '11500', currency: 'SAR', state: 'paid' }], total: 1 };
    else data = { items: [{ id: 'fixture', baseSalary: '10000', allowanceTotal: '2500', deductionTotal: '1000', netPay: '11500', currency: 'SAR', payrollRun: { period: '2026-11' } }], loans: [], advances: [], total: 1 };
    await route.fulfill({ status: rejectReport && url.pathname.endsWith('/export') ? 500 : 200, json: data });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const results = [];
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const view of ['register', 'detail', 'advances', 'finance', 'payslip', 'report', 'document', 'reports', 'process', 'compensation']) {
      await page.goto(view === 'document' ? `${base}/document` : `${base}/?view=${view}`);
      if (['register', 'detail', 'finance', 'payslip', 'report'].includes(view)) await page.getByText(view === 'detail' ? 'الراتب الأساسي' : view === 'report' ? 'كشف الرواتب التفصيلي' : view === 'register' ? 'تفاصيل البنود' : view === 'payslip' ? 'الإضافات' : 'الصافي المصروف', { exact: view === 'detail' }).first().waitFor();
      if (view === 'advances') { await page.getByRole('button', { name: 'طلب سلفة جديدة' }).click(); await page.getByLabel('قيمة السلفة (ر.س)').fill('1000'); }
      if (view === 'detail') {
        await page.getByRole('button', { name: /الاستقطاعات/ }).click();
        assert.equal(await page.getByText('قسط السلفة', { exact: true }).isVisible(), true);
        assert.equal(await page.getByText('الراتب الأساسي', { exact: true }).isVisible(), false);
        await page.emulateMedia({ media: 'print' });
        assert.equal(await page.getByText('الراتب الأساسي', { exact: true }).isVisible(), true);
        assert.equal(await page.locator('.payroll-line-table tr').last().evaluate(el => getComputedStyle(el).display), 'table-row');
        assert.notEqual(await page.locator('.payroll-document .text-white').evaluate(el => getComputedStyle(el).color), 'rgb(255, 255, 255)');
        await page.emulateMedia({ media: 'screen' });
      }
      const size = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert.ok(size.content <= size.viewport + 1, `${view} at ${width}px overflows: ${JSON.stringify(size)}`);
      await page.screenshot({ path: `${artifacts}/${view}-${width}.png`, fullPage: true });
      if (view === 'register') {
        await page.getByRole('button', { name: 'جدول', exact: true }).click();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert.equal(overflow, false, `register table overflows page at ${width}px`);
      }
      results.push({ view, width, passed: true });
    }
  }
  rejectReport = true;
  await page.goto(`${base}/?view=report`);
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByRole('button', { name: 'طباعة / حفظ PDF' }).isDisabled(), true);
  rejectReport = false;
  await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
  await page.getByText('كشف الرواتب التفصيلي').waitFor();
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: `${artifacts}/payroll-register.pdf`, landscape: true });
  await page.goto(`${base}/?view=detail`);
  await page.getByText('الراتب الأساسي', { exact: true }).waitFor();
  await page.screenshot({path: `${artifacts}/detail-print.png`, fullPage: true});

  assert.equal(await page.locator('.payroll-dialog-overlay').evaluate(el => getComputedStyle(el).opacity), '1');
  await page.pdf({ path: `${artifacts}/payslip.pdf` });
  assert.deepEqual(errors, [], 'browser errors');
  await writeFile(`${artifacts}/results.json`, JSON.stringify(results, null, 2));
  console.log(`Passed ${results.length} viewport checks, table layout, payslip print, and report error/retry. Artifacts: ${artifacts}`);
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
