# MADAR HR upgrade progress

Baseline: c0a67b1e8957082a556f9f0df3cd4928dac6e2ba. CI: https://github.com/gala775554988-cloud/Lana-HRMS/actions/runs/45606420607 (passed). No production verification claimed. Unverified means existing functionality may be present but acceptance evidence is missing.

| # | المتطلب | الحالة | التنفيذ والاختبارات المثبتة | المتبقي / العائق |
|---|---|---|---|---|
| 1 | بيانات المشروع الحالي | محدد | المستودع والفرع والنطاق محددة؛ CI 45624237702 على 3241561. | لا يوجد |
| 2 | تعليمات التنفيذ الإلزامية | جارٍ | حماية البيانات، دفعات ذرية، عدم نشر الإنتاج؛ الاختبارات المعزولة فقط. | إتمام بوابة الإصدار |
| 3 | إصلاح تسجيل الدخول والصلاحيات | جزئي | ترحيل sidebarHue وWebAuthn؛ اختبارات auth ضمن 206 ناجحة. | اختبار دخول الأدمن الفعلي وRBAC في المعاينة |
| 4 | المزامنة التلقائية الشاملة مع Odoo | جزئي | جدولة GitHub Actions مشروطة، قفل قاعدة البيانات؛ لم يثبت التشغيل. | سر الجدولة وتفعيلها بعد النشر؛ خطة Vercel غير معلومة |
| 5 | إصلاح أخطاء المزامنة السابقة | عائق خارجي | تشخيص الأخطاء وإعادة المحاولة حسب السجل؛ اختبارات Odoo ضمن 206 ناجحة. | لا وصول موثق لسجلات الإنتاج الـ70 ولا إثبات إصلاح |
| 6 | إنشاء محرك مركزي لجميع طلبات الموظفين | جزئي | محرك الاعتماد المحلي والمعاملات؛ تكامل PostgreSQL ناجح. | توحيد باقي الطلبات والتكامل الخارجي |
| 7 | الربط التلقائي للإجازات | جزئي | رصيد سنوي وإلغاء مرة واحدة وشرائح مرضية وغير مدفوعة؛ تكامل ناجح. | مطابقة الأرصدة الفعلية وجميع الأنواع والحضور |
| 8 | الربط التلقائي للسلف والقروض | جزئي | فصل الاعتماد والصرف، مراجعة تاريخية إلزامية؛ اختبار تسوية PostgreSQL ناجح. | مستندات الصرف الحقيقية ومطابقة Odoo |
| 9 | الربط التلقائي لجميع الطلبات الأخرى | جزئي | سجل أثر الاعتماد؛ لم يثبت أثر كل نوع مستقل. | ربط تنفيذ الطلبات الوظيفية والمالية الباقية |
| 10 | تطوير نظام الرواتب بالكامل | جزئي | احتساب وتجميد الرواتب والخصومات؛ تكامل تسوية ناجح. | قبول شامل للحالات والاستحقاقات |
| 11 | مسيرات الرواتب والاعتمادات | جزئي | مسارات اعتماد وصرف وقفل، منع ازدواج الخصم؛ تكامل ناجح. | قبول واجهات وأدوار ومراجعة مراجع الصرف |
| 12 | التأمينات الاجتماعية والالتزام النظامي | جزئي | شرائح سعودية فعالة زمنياً وفئات خليجية قابلة للضبط؛ اختبارات الحساب ناجحة. | اعتماد إعدادات الإنتاج والفئات الخاصة |
| 13 | العمل الإضافي والحضور والانصراف | جزئي | ربط الإضافي والإجازات والحضور بالحساب؛ اختبارات وحدات ناجحة. | قبول الحضور الفعلي والمبالغ النظامية |
| 14 | الحساب المالي الموحد لكل موظف | جزئي | قيود مفصلة ومفاتيح فريدة وملخص عملة؛ تكامل ناجح. | مطابقة التاريخ والقيود الخارجية |
| 15 | الملف الموحد للموظف | جزئي | سجل تنفيذ الطلبات والحساب المالي. | دمج كامل في ملف الموظف واختبار الواجهة |
| 16 | الموظفون المؤرشفون والمنتهية خدماتهم | جزئي | نطاق صلاحيات المؤرشفين وتصحيح آخر نشاط. | قبول سجل التاريخ وقياس سرعة فعلي |
| 17 | المخالصة النهائية ونهاية الخدمة | جزئي | مخالصة واعتماد وصرف موثق ومراجعة الدين؛ اختبارات الحساب ناجحة. | اختبار دورة المخالصة الفعلية كاملة |
| 18 | قسائم الرواتب والتحويلات البنكية | جزئي | PDF ثنائي اللغة ومراجعة البنك وحفظ الملف؛ تصدير 2/2 ناجح. | ملف مصرفي حقيقي، ختم غير متحقق ومدد غير مرسل |
| 19 | الربط المحاسبي والمالي | جزئي | دليل ربط Odoo وoutbox وقيود الرواتب؛ لم يثبت ترحيل فعلي. | قبول القيود ومراكز التكلفة ومطابقة Odoo |
| 20 | الميزانيات وسلم الرواتب والتكاليف | جزئي | ميزانيات وسلم رواتب وضوابط إلزامية؛ اختبارات حساب ناجحة. | قبول إعدادات المراكز والسياسات الحقيقية |
| 21 | التقارير ولوحات التحكم | جزئي | تقارير مجمعة بالعملة والفترة ومركز التكلفة، PDF/XLSX؛ تصدير ناجح. | قبول التقارير التاريخية وكامل الإدارات |
| 22 | الاستيراد والتصدير | جزئي | تصدير مالي؛ الاستيراد الجماعي غير مغلق. | معاينة وتحقيق الاستيراد ومنع التكرار |
| 23 | الخدمة الذاتية للموظفين | جزئي | كشف مالي وقسائم وطلبات وإلغاء؛ تكامل الطلبات ناجح. | جميع الخدمات والأدوار على الواجهة |
| 24 | محرك قواعد الأتمتة | جزئي | قواعد تنبيه محفوظة ومفاتيح تكرار؛ اختبارات وحدات ناجحة. | تشغيل الجدولة الفعلي وباقي قواعد الأتمتة |
| 25 | منع التكرار والأخطاء | جزئي | مفاتيح فريدة ومعاملات وقفل؛ اختبار الدفع المتزامن ناجح. | اختبارات كل مصادر الأثر والاستيراد |
| 26 | الإلغاء والتعديل والتسويات | جزئي | إلغاء إجازة وتسوية محمية؛ تكامل ناجح. | التصحيحات النقدية والقيود العكسية |
| 27 | الإشعارات والمراقبة | جزئي | تنبيهات عقود ومستندات وطلبات وأخطاء؛ اختبارات قواعد ناجحة. | تفعيل الإنتاج واختبار التسليم |
| 28 | الذكاء الاصطناعي والتحقق المالي | جزئي | مطابقة البنك والميزانية والتقارير واكتشاف الشذوذ. | توسيع التحقق ومراجعة بشرية |
| 29 | الصلاحيات والأمان وسجل التدقيق | جزئي | صلاحيات وحماية قسائم وسجل تدقيق؛ اختبارات auth ناجحة. | اختبار مصفوفة الأدوار كاملة |
| 30 | تطوير التصميم والهوية البصرية | جزئي | ألوان خضراء مركزية وتقارير وأتمتة ورواتب. | فحص جميع الصفحات والأجهزة |
| 31 | تحسين الأداء والسرعة | جزئي | بحث مؤرشفين محدود وترقيم صفحات؛ لا قياس قبول. | اختبار حمل وفهارس وخفض الاستعلامات |
| 32 | المحافظة على جميع البيانات الحالية | جزئي | ترحيلات إضافية PostgreSQL ناجحة؛ فحص drift تشخيصي فقط. | نسخة احتياطية إنتاجية ومراجعة الفروقات دون إسقاط فهارس |
| 33 | الاختبارات الشاملة قبل النشر | جارٍ | 206/206، تكاملان PostgreSQL، تصدير 2/2 وLint ناجحة في 45624237702؛ TypeScript فشل، Build لم يبدأ. | إعادة CI بعد إصلاح الأنواع، E2E ومعاينة |
| 34 | خطة التنفيذ المتواصل | جارٍ | جدول 37 محدّث ومراحل التنفيذ محفوظة. | استمرار إغلاق المهام |
| 35 | الرفع والدمج والنشر النهائي مرة واحدة | مؤجل | لم يدمج أو ينشر. | نجاح كل بوابات القبول |
| 36 | التقرير النهائي المطلوب | مؤجل | تقارير مرحلية فقط. | تقرير قبول نهائي ونشر مؤكد |
| 37 | إدارة المهام والتكليفات – LANA PRO V9.5 Smart Workflow | مؤجل | مرجع Smart Workflow محدد؛ لم تبدأ برمجة المتطلب. | بعد إكمال الوظائف الداخلية الأصلية حسب ترتيب المستخدم |

## Release gate
Do not merge until all 37 acceptance criteria, isolated tests, backup and preview checks pass. Implement #37 after completing original 36 as requested. No real transfers or destructive operations during tests.

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

- Follow-up compatibility fix: ES2017-safe BigInt constructors, explicit JSON warning shape, restrictive foreign keys for budget policies, and original bank filename retained on download. 4321dc1 CI had passed migration and fixtures and reached lint at check; latest build still pending.

## Batch after b50c7d7
- CI 45619713730, 45619617656, 45619410798 and 45618367402 completed successfully. This is build/unit evidence, not production acceptance.
- #18/#21/#22/#28/#29: payroll reports partition totals by period/status/currency/group with integer cents, include employer contribution and cost-center report, expose reconciliation variance, cap oversized exports without silent truncation, direct Arabic-capable XLSX/PDF exports and audit. Employee payslip PDF uses shared Unicode export font, adds paid date and employer share. Administrative payslip requires payroll permission, masks sensitive IDs/IBAN and removes salary from QR, private no-store. Green document colors. Existing historical attribution remains current employee department/branch, not a historical snapshot. New CI pending.
- #37: reference located as online_viewer_net (23).htm.html, title LANA PRO V9.5 | Smart Workflow. Four columns جديد / قيد التنفيذ / مراجعة / مكتمل; category and department filters, urgent tasks, search, grid and Kanban, subtasks, comments, attachments, JSON import/export. Acceptance requires central DB, individual/group and department assignment, hierarchy roles, calendar/table/Kanban, progress and review, recurring tasks, reminders/escalation, employee profile and self-service, KPIs, Excel/PDF, audited non-destructive JSON import and event-triggered tasks for expiring documents/contracts, payroll, pending requests, violations, settlements and sync failures. No LocalStorage or financial penalties. Deferred until requirements 1–36 accepted per explicit sequence.

## Automation rules after b0ba2c2
- #24/#27/#29: persisted opt-in rules for verified document and active contract expiry, overdue approval stages and open Odoo failures. Scheduled endpoint creates in-app notifications with unique event/user keys, no duplicate inserts even on retry, no financial effects. Policy UI and authorized audit; scheduler invokes alerts alongside repair every 30 minutes. Push fallback test token removed and missing credentials no longer pretend success or log content. No production rules activated; no push delivery or scheduler acceptance claimed. Approval SLA based on workflow updatedAt, not separately tracked stage start; verify with actual stage history. #37 deferred.
- #33: migration and rule tests pending CI.

## Batch after ef28fd8
- CI 45620854848 failed one of 181 tests: legacy employee payslip fixture missing adapter for new Unicode table export. Updated adapter to real current dependency; no test removed. New CI required.
- #6/#7/#25/#26/#29: local workflow final decision verifies source ownership/status, runs serializable transaction, rejects overlapping approved leave and already-paid payroll periods, checks annual balance at approval and atomically consumes it without overdraft. Approved revocation rejects paid periods and paid final settlements, and blocks inconsistent balance reversal. Regression fixtures cover rollback. Legacy default annual balance behavior unchanged; paid-period adjustments require reviewed correction workflow, not an automatic reversal. Odoo-owned decisions remain separate. #37 deferred per user order.

## Debt disbursement separation after ac3c691
- #8/#10/#14/#17/#23/#25/#29: new employee advances and locally finalized loan requests require explicit recorded external disbursement before payroll deduction or final settlement. Additive fields and unique confirmation reference/source table, transactional confirmation UI/API, employee timeline/notification, no bank operation. Loan confirmation requires separate reviewer from workflow approvers. Advance confirmation verifies all three approval stages and is not self-approved. Historic and Odoo debt left unchanged; direct admin-created loans and legacy approved requests require a separate review. No claim of actual production payment.
- CI 45621059357 failed the same outdated PDF test adapter as 45620854848 (182/183 passed); ac3c691 fixes it. New migration and test pending CI. #37 not started pending original acceptance.

## CI recovery after 5410d7f
- #33: run 45621755008 confirmed 184/185 tests passed, migrations passed, fixture failure caused by outdated self-service test transaction missing payrollItem.findFirst and employeeFinalSettlement.findFirst, and updateMany result count. Updated the fixture with explicit dates, realistic guards and count; preserved original annual/sick/double-revoke assertions and added paid payroll/final settlement rejection tests. No weakening of production checks. CI reruns on push; lint/build not yet verified. #37 remains deferred per requested sequence.

## Database integration and payroll query correction
- #7/#10/#13: corrected reversed Promise.all attendance/approvedLeave bindings (production logic, not test bypass), and reject SAR advance deduction against non-SAR salary. Payslip uses snapshot basic once, not duplicated. #33: CI now executes real Prisma workflow and payroll settlement scripts on ephemeral localhost hrms_test with guarded cleanup; restored missing ledger adapter, fixed fixture dates and restrictive FK cleanup, added explicit typecheck. All stages must pass before merge. New CI pending.

## Historical debt evidence review
- #8/#10/#17/#25/#29: additive separate debt-review records with evidence reference, source identity, principal/currency, review decision, role guard, no self-review and audit. Payroll calculation and settlement and final settlement refuse unverified historical local debts; no mutation of historic loan/advance balances or proof fabricated. This may block payroll until reviewers document outstanding local debts; no retrospective changes. Odoo-origin debt remains on existing external installment reconciliation path and still needs external evidence. New tests and migration pending. #37 deferred.

- CI coverage extended to existing Odoo and Odoo migration test suites; ledger fixture updated for real historical review dependency. Database integration asserts detailed failure diagnostics rather than masking them. New CI pending.

## Schema drift uncovered by actual integration
- CI 45623609108 passed all stages (including original revocation test, migrations, lint and build). CI 45623786141 passed fixture tests, then failed actual local PostgreSQL integration with Prisma P2022: User.sidebarHue missing. Added idempotent additive migration for User.sidebarHue/currentChallenge and BiometricCredential table/index/FK. Existing rows and passkeys retained. Added non-mutating schema diff diagnostic to CI; further discrepancies must be reviewed, never automatically applied to production. Latest expanded integration suite not yet confirmed. #3/#29/#32/#33 remain gated.

## Batch after 3241561
- CI 45624237702: 206/206 fixture tests, both PostgreSQL integrations, 2/2 exports, migrations and lint passed; standalone typecheck failed 21 diagnostics, build skipped. Addressed extended Prisma transaction typing, explicit bigint reductions, nullable run capture and loan-only installment narrowing. No typecheck suppression or test deletion. Main tracker rewritten with per-item implementation, evidence and blockers. New CI pending.
