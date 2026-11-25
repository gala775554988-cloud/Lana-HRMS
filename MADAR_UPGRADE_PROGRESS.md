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

## Batch after a43b2d67
- #8/#10/#11/#14: shared advanceSchedule integer-halalas calculation in payroll engine, settlement and employee salary display. Last installment absorbs rounding; paid advances stop; frozen amount changes require recomputation. Existing closed records are not reopened. Disbursement approval separation still pending.
- #33: added final-installment regression tests. Prior CI 45611964293 passed fixture and export stages; full build not yet confirmed.

## Scheduled sync hardening
- #4/#27: incremental cron uses a token-owned database lease, records failures and checks request-pull errors, and automation health exposes latest cron result and freshness. Five-minute cron config retained. Vercel team response did not disclose plan; production schedule and 70 historical records still unverified. No production writes performed.
- #23/#29: employee payroll response private no-store and bounded pagination.

## Batch after 9d9ff5f
- #7/#10/#13: approved paid annual leave is excluded from absence, half-day and late deductions using Saudi calendar dates. No attendance records overwritten. Sick/unpaid leave rules remain separate and need policy acceptance.
- #6/#9/#15/#26: local completed requests now create a transactional approval timeline record without representing approval as payment; revocation reverses that record. Other business-specific execution still pending.
- #33: a43b2d67 CI 45611964293 passed all stages; 51cf1a7 fixtures passed but build in progress at check. Added annual leave and workflow regression assertions.

## Batch after 360ac13
- #8/#10/#11/#14/#25: payroll settlement generates itemized ledger postings for basic salary, allowances, bonus, overtime, insurance, absence, late, other deductions and each loan/advance installment. Frozen snapshot reconciliation rejects mismatches before approval/payment. Existing historical aggregate postings are preserved and not duplicated. No bank transfer performed.
- #15/#23/#29: self-service ledger displays effect type and request type; scoped admin API includes safe request-type metadata, no raw workflow metadata. Payroll detail private no-store.
- #33: CI 45612836696, 45612503614, 45612390089 and 45611964293 completed successfully. New ledger-breakdown tests pending CI.

## Batch after 5a576e3
- #17/#29/#32: additive EmployeeFinalSettlement model and migration; HR-only draft and independent approval, persisted calculation snapshot, outstanding active loan/advance calculation, transactional audit and approval timeline. UI at /final-settlements linked from payroll settings. No actual payment, contract closure or debt writeoff. ACT/365 estimate requires HR review; official reference https://www.hrsd.gov.sa/media-center/media/lerightseocontract . Existing records preserved. Cancellation/revision and payment reconciliation need further implementation.
- #30: payroll page navigation and primary actions changed to green.
- #33: added final settlement validation and calculation tests; CI pending. 5a576e3 CI was still running at last check.

## Batch after b9f338a
- #17/#14/#8/#25/#26/#29: additive payment-confirmation columns and unique reference; external payment attestation by another approver, frozen source identities, changed-source check, local debt closure and itemized ledger posting in serializable transaction. No bank call. Odoo-origin debt blocks confirmation until reconciled; legacy snapshots need review; manual leave encashment and unpaid wage amounts remain reviewed inputs (no automatic leave balance write-off). Revised/cancelled drafts retain previous snapshots in audit. Payroll blocks settlement after confirmed final settlement; pending payroll blocks final settlement.
- #23/#30: employee ledger labels and settlement confirmation form.
- #33: CI 45614957546 passed; new tests and migration pending CI.

## Batch after 780be44
- #17/#7/#8/#25/#26: final settlement now computes full documented leave balance cash-out, checks pending leave and unchanged source balance and consumes days atomically upon confirmed external payment. Missing structured balance blocks cash-out; no fabricated balance. Odoo loans use exactly reconciled unpaid installment IDs and existing localPaidAt migration reconciliation mechanism; no remote paid flag mutation or external transfer. Approved unpaid settlements can return for reviewed revision, with audit. Production reconciliation still unverified.
- #33: CI 45615826979 and 45615356147 passed. Added cash-out and Odoo installment reconciliation tests; new CI pending.

## Batch after b398916
- #12: official standard NEW GOSI schedule 2024–2028, explicit installation by authorized reviewer without overwrites, employee/employer separation, explicit non-Saudi occupational-hazard cohort, registered contribution wage and currency validation. Special GCC/coverage exceptions still require reviewed configuration. Sources https://awareness.gosi.gov.sa/businessJourney.html and https://beta.gosi.gov.sa/new-system . No production policies changed.
- #7/#10/#13/#14: approved unpaid and sick leave payroll calculation, first sick leave anniversary and 30/60/30 tiers, suppress attendance deductions for covered dates, itemized leave deduction in settlement ledger. Partial-day/ambiguous overlaps blocked for review; no attendance edits. Source https://www.hrsd.gov.sa/media-center/media/levacation . Annual/type balance reconciliation remains pending.
- #33: regression tests added; b398916 CI 45617471217 was running at check. New CI pending.

## Batch after 9e6169f
- #12: explicit GCC country cohorts, nationality match, registered wage required, source-reference attestation for new GCC policies. Rates are not invented: home-state rules and host employer ceiling need documented verification before use. Official source https://beta.gosi.gov.sa/insurance-protection . No production policies modified.
- #18/#21/#28/#29: internal bank preflight checks company, SAR, IBAN, primary account, duplicates and arithmetic; warnings for shared IBAN and high deductions, audited export explicitly not WPS. Ministry requires original bank-stamped file and 30-day upload window; no bank integration or Mudad upload performed. Source https://www.hrsd.gov.sa/knowledge-centre/initiatives/national-transformation-initiatives-bank/108808 .
- #33: b398916 CI 45617471217 passed; 9e6169f CI 45617861918 reached build. New tests pending CI.

## Batch after 3e21515
- #4/#27: Vercel team API confirmed Lanahr but omitted plan; env metadata confirms INTERNAL_SYNC_TOKEN production key, no CRON_SECRET in returned list; no cron-related runtime log counts in checked 50m. Replaced native subdaily Vercel crons in development with opt-in GitHub Actions scheduler (public repository standard runners, no new subscription). Requires GitHub secret MADAR_SYNC_TOKEN corresponding to the existing internal token and MADAR_SCHEDULER_ENABLED=true after final deployment. Default branch only, best effort five-minute cadence, subject to GitHub delays. No secret copied or schedule activated. Verify cadence before acceptance; do not enable native and external schedulers together. Queue now authenticates internal token and returns unsuccessful status on failed jobs.
- #5/#27: paginated actual migration error records, reason counts, individual retry on automation page; production access still unverified, 70 not claimed repaired.
- #18/#21/#25/#29/#32: additive bank evidence table retains original bytes and SHA-256, reconciles separate attested bank report by employee, IBAN, SAR and cents, restricts access to payroll approvers, audit and deduplication, downloadable unchanged bytes. No signature verification, no Mudad submission, no transfer, and current primary account comparison not historical bank snapshot. Bank-supplied original format is intentionally opaque. Test with real sanitized bank report before acceptance.
- #16/#29/#31: archived employee list applies hierarchy scope, bounds paging/search, excludes future-only termination from archival, fixes last-active source and ignores unapproved/future leave; no data changed.
- #33: CI 45618367402 and 45617861918 passed; new migration and tests pending.

## Budget and salary controls after 4321dc1
- #20/#19/#28: additive budget limits per financial period, cost center and currency; salary bands by position/currency, UI and authorized policy editing with audit. Payroll approval and confirmation check opted-in blocking limits and record advisory findings. Cost includes gross plus employer insurance, committed approved or paid runs, excludes current run. No retroactive salary edits. Configurations not installed in production; full cost allocations and historical policy versions remain unverified.
- #33: added budget-control tests; new CI pending.
