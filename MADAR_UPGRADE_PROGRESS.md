# MADAR HR upgrade progress

Baseline: c0a67b1e8957082a556f9f0df3cd4928dac6e2ba. CI: https://github.com/gala775554988-cloud/Lana-HRMS/actions/runs/45606420607 (passed). No production verification claimed. Unverified means existing functionality may be present but acceptance evidence is missing.

| # | Original requirement | Status / files / evidence |
|---|---|---|
| 1 | بيانات المشروع الحالي | Repository and branch established |
| 2 | تعليمات التنفيذ الإلزامية | Partial: no production deployment or destructive migration |
| 3 | إصلاح تسجيل الدخول والصلاحيات | Pending verification and remaining implementation |
| 4 | المزامنة التلقائية الشاملة مع Odoo | Partial: vercel.json; app/api/integrations/odoo/cron-sync/route.ts; cron-reconcile; production cadence unverified |
| 5 | إصلاح أخطاء المزامنة السابقة | Partial: cron-repair and retry-errors endpoints; actual 70 records unresolved/unverified |
| 6 | إنشاء محرك مركزي لجميع طلبات الموظفين | Partial: lib/enterprise/workflow.ts; tests/workflows/workflow.test.mjs |
| 7 | الربط التلقائي للإجازات | Partial: leave approval event; attendance/payroll reconciliation still needs verification |
| 8 | الربط التلقائي للسلف والقروض | Pending verification and remaining implementation |
| 9 | الربط التلقائي لجميع الطلبات الأخرى | Pending verification and remaining implementation |
| 10 | تطوير نظام الرواتب بالكامل | Partial: payroll settlement ledger; full calculations unverified |
| 11 | مسيرات الرواتب والاعتمادات | Partial: app/api/enterprise/payroll/run/[id]/route.ts |
| 12 | التأمينات الاجتماعية والالتزام النظامي | Pending verification and remaining implementation |
| 13 | العمل الإضافي والحضور والانصراف | Partial: overtime approval event; payroll integration needs verification |
| 14 | الحساب المالي الموحد لكل موظف | Partial: lib/enterprise/employee-financial-ledger.ts; tests/payroll/employee-ledger.test.mjs; ledger APIs |
| 15 | الملف الموحد للموظف | Partial: request execution timeline API; full profile integration pending |
| 16 | الموظفون المؤرشفون والمنتهية خدماتهم | Pending verification and remaining implementation |
| 17 | المخالصة النهائية ونهاية الخدمة | Pending verification and remaining implementation |
| 18 | قسائم الرواتب والتحويلات البنكية | Pending verification and remaining implementation |
| 19 | الربط المحاسبي والمالي | Pending verification and remaining implementation |
| 20 | الميزانيات وسلم الرواتب والتكاليف | Pending verification and remaining implementation |
| 21 | التقارير ولوحات التحكم | Pending verification and remaining implementation |
| 22 | الاستيراد والتصدير | Pending verification and remaining implementation |
| 23 | الخدمة الذاتية للموظفين | Partial: app/api/employee/financial-ledger/route.ts |
| 24 | محرك قواعد الأتمتة | Pending verification and remaining implementation |
| 25 | منع التكرار والأخطاء | Partial: unique source/effect keys in prisma/schema.prisma and additive migration; ledger tests |
| 26 | الإلغاء والتعديل والتسويات | Partial: informational approval revocation; monetary reversals pending |
| 27 | الإشعارات والمراقبة | Partial: automation-health page and API |
| 28 | الذكاء الاصطناعي والتحقق المالي | Pending verification and remaining implementation |
| 29 | الصلاحيات والأمان وسجل التدقيق | Partial: scoped ledger API; full RBAC audit pending |
| 30 | تطوير التصميم والهوية البصرية | Partial: app/globals.css; automation-health page |
| 31 | تحسين الأداء والسرعة | Pending verification and remaining implementation |
| 32 | المحافظة على جميع البيانات الحالية | Partial: additive migration tested in CI; production backup and verification pending |
| 33 | الاختبارات الشاملة قبل النشر | Partial: CI run 45606420607 passed at c0a67b1; E2E and production verification pending |
| 34 | خطة التنفيذ المتواصل | In progress: this tracker |
| 35 | الرفع والدمج والنشر النهائي مرة واحدة | Pending: merge and production deployment gated |
| 36 | التقرير النهائي المطلوب | Pending: final report |

## Release gate
Do not merge until all acceptance criteria, isolated tests, backup and preview checks pass. No real transfers or destructive operations during tests.

## Batch after 45addd6
- #5: migration retry now counts source read failures, transactionally reconciles counters/audit, and both retry endpoints verify persisted resolution. Actual production errors remain unverified.
- #14/#23/#30: employee salary page displays session-scoped ledger, exact decimal totals, pagination and recent execution events; no payment action. API private no-store. Historical backfill not yet implemented.
- #33: exact decimal regression normalizes VM realm values; payroll command includes all payroll unit tests. CI pending for this batch.
