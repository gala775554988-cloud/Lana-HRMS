# Lana × Odoo request center

The main Requests navigation opens `/approvals?tab=odoo`. Employee access is
`/employee/requests?tab=odoo`. Existing local inboxes and routing remain available.

## Services requested from the Odoo Approvals screenshot

Projects payment, leave settlement, end-of-service settlement, financial custody,
BSF payment, overtime, payroll payment, salary advance, and HR petty cash.
These are explicit service definitions, not guessed Odoo category IDs. The
administrator must associate each service with its actual `approval.category` ID.

## Activation and verification

1. Sign in as an authorized HR administrator and open **ضبط الربط**.
2. Discover the saved Odoo connection. Its URL/database fingerprint must match
   `odoo.migration.employeeSource`; employee identities must have been reconciled.
3. Select verified request applications. Map services to actual approval
   categories; separately map native leave types to their actual Odoo type IDs.
4. Preview each category's real sequence, required approvers, manager rule,
   minimum approvals, and conditional fields. No approval policy is written to
   Odoo and no unknown model method is guessed.
5. Enable and save. Run **مزامنة الآن** to import an initial batch; subsequent
   bounded pulls resume using source-specific checkpoints.
6. Test an authorized request and verify both its `LRQ-...` reference and remote
   ID. Compare actual fields and approver order in Odoo before operational rollout.

Source discovery and activation have not been verified against a signed-in live
Odoo account by the automated tests. Do not treat a green application health check
as evidence that request models, permissions, or category mappings are configured.

## Immediate outbound delivery and inbound events

Submitting a mapped local workflow atomically saves an outbox record. The server
attempts delivery after commit, using a verified employee/user identity and the
employee's company when writable. General approvals use `action_confirm`; native
leave uses its supported confirmation action only while draft. Other/custom
applications are read-only until their business actions can be verified.

A lost create acknowledgement is reconciled using the exact request reference and
owner. An uncertain write is never blindly repeated. Attachments are signature-
checked PDF/PNG/JPEG files, at most five, 1.5 MB per file and 2.5 MB combined. Their
uploads also have stable markers and acknowledgement recovery. The server uploads
and associates them before confirmation. Failed delivery stays visible in Lana.

For immediate Odoo-to-Lana updates, create a reception key in the settings and
configure Odoo's automated webhook to POST to
`/api/integrations/webhooks/odoo-requests` with `Authorization: Bearer <key>`.
Bodies can use either `{ "model": "approval.request", "id": 123 }` or Odoo's
`{ "_model": "approval.request", "_id": 123 }` envelope. Set triggers for request
creation/state changes and approver decisions. Events on `approval.approver` are also supported: the receiver reads its
verified `request_id` relationship from Odoo and refreshes the parent request.
It never trusts a posted parent ID.
Only a key hash is stored; rotation invalidates the old key.

The receiver ignores posted statuses, amounts, and employees and re-reads Odoo.
It returns a non-success code when the record cannot be verified. The HR center
also polls lists and, while visible, triggers a leased pull every minute. The
existing daily cron attempts a bounded recovery pass. An external authorized
scheduler may call `/api/integrations/odoo/sync/requests` with `CRON_SECRET` or the
configured internal sync credential. This is **not** a claim of realtime delivery
until the Odoo webhook has been installed and tested; changes made while no user
is viewing the center otherwise wait for the next scheduled/pull cycle.

## State and authority

Draft, pending, approved, completed, rejected, cancelled and unknown are separate.
An unfamiliar state stays unknown. Original remote status/reference and bounded
history are preserved; a stale notification cannot regress a newer snapshot.
Unmatched/duplicate employee identities are retained for retry, not assigned by name.

Decisions and changes for a linked request remain in its native Odoo approval
path. Lana shows approvers and opens that path instead of impersonating an Odoo
approver through the service account. Unmapped types retain the local approval
engine. Mirroring a remote approval updates request tracking, **not** financial
balances, payroll settlement, custody delivery or statutory leave consumption.
Those operational records use their own verified integrations.

## Storage and security

Existing `AppSetting` rows hold configuration, private request snapshots and a
transactional outbox, requiring no new production schema migration. Private
record and attachment values are hidden from ordinary settings listings. The
request API intersects records with employee scope; source, raw upload data and
submission payloads are not returned. Downloads recheck scope and source ownership.
All mutation/configuration routes are authenticated; webhook authentication is
independent. Only an authorized HR administrator can enable models or rotate keys.

For larger installations, move snapshot/outbox data to dedicated indexed tables
before increasing retention substantially. Current list operations paginate
records server-side, but JSON scope/count queries are intended for the existing
single-organization deployment.

## Verification

- `node --experimental-vm-modules --test tests/odoo-requests/*.test.mjs tests/workflows/*.test.mjs`
- `node tests/odoo-requests/browser.mjs`
- `npm run typecheck`

Browser fixtures use synthetic API responses and actual client components at
320, 390, 768, 1024 and 1440 pixels. Screenshots are written to
`/tmp/odoo-requests-preview`. They verify layout and behavior, not live Odoo rights
or webhook installation. No real approval, payment, or employee data is created by tests.


## فصل مساحات العمل

- `/approvals?tab=center`: وارد طلبات الموظفين ومسارات مراجعتها في لانا؛ الطلب المحوّل يحتفظ بمرجعه ورابط تتبعه.
- `/approvals?tab=odoo`: الطلبات المرفوعة من لانا إلى أودو فقط (`origin=LANA`)، بما فيها الإرسال المعلّق أو غير المؤكد، ونماذج الخدمات التسع.
- `/approvals?tab=sync`: إدارة الربط والاستيراد للمسؤول المخوّل، وآخر دورة مزامنة والسجلات المنشأة في أودو (`origin=ODOO`). السحب الدوري أثناء فتح الصفحة محصور بهذه المساحة.

مرشح المصدر يطبق على قائمة السجلات والإجمالي وجميع عدادات الحالات مع الحفاظ على نطاق صلاحيات الموظفين. تحديث قائمة الإرسال لا يشغّل استيرادًا عامًا. روابط الموظفين الحالية إلى أودو تفتح مساحة الإرسال دون أدوات ضبط الربط.
