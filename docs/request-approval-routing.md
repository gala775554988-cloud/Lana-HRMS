# Request routing

`/approvals?tab=routing` configures ten request categories for all companies or a named company. Access requires HR_MANAGER, SUPER_ADMIN, manage:permissions or manage:settings; managing ordinary requests does not authorize changing company-wide rules.

Routes can use the direct manager, a bounded management hierarchy, an HR officer or named active employees. Duplicate approvers are collapsed. Missing managers proceed to the independent HR stage; missing mandatory named approvers stop submission. No request is automatically approved because its route is absent. `/approvals?tab=paths` manages explicit organizational ApprovalPath records. These take precedence over the company fallback rules.

The preview resolves actual people for the selected employee and honors organizational overrides. Saving uses an optimistic version check and records the policy change in AuditLog. Request creation and workflow creation share a transaction. Rules affect new requests; in-flight steps retain their approvers, stage labels and SLA snapshot. Replacements require an explicit audited transfer, not implicit index-based reassignment when the hierarchy changes.

Only the assigned approver may decide the active step, never the requester. Later steps wait. Rejection and return require a reason. Compare-and-set updates inside one transaction prevent duplicate decisions and duplicate annual-leave usage. Active-step transfers cannot reopen a terminal workflow. Cancellation withdraws the workflow and pending steps atomically.

Loan requests remain PENDING until final approval. The additive LoanStatus migration adds that state without modifying historical loans. The production schema bootstrap executes the same idempotent enum addition before traffic uses the generated client.

## Saudi employment rules and scope

These are configurable internal approval procedures for the employer. They do not define a universal statutory chain for every Saudi sector or replace the applicable employment regime, contract, approved work regulations, leave-entitlement/payroll rules or required government-platform procedures.

The implementation keeps the requested leave type, refuses unknown/inactive types rather than substituting a different entitlement, and does not debit sick/special leave from the annual-leave aggregate. Internal SLA expiry never means approval or waiver of rights. Overtime pay and statutory entitlements remain separate calculations; configuring a workflow does not certify those calculations or every Saudi regulation.

Primary reference reviewed on 2026-11-01: [HRSD — Working conditions / Labor Law](https://www.hrsd.gov.sa/شروط-العمل-وظروفه), including annual leave (109), special leave (113), sick leave (117), overtime (107), and deductions (92–93). The request-routing editor links to this source. Rules for different employment regimes must be configured and reviewed for the establishment; the editor does not label its routing presets as legally mandated sequences.

## Verification

```sh
node --experimental-vm-modules tests/workflows/routing.test.mjs
node --experimental-vm-modules tests/workflows/workflow.test.mjs
node --experimental-vm-modules tests/workflows/request-creation.test.mjs
node --experimental-vm-modules tests/workflows/routing-api.test.mjs
node --experimental-vm-modules tests/workflows/cancellation.test.mjs
npm run typecheck
```
