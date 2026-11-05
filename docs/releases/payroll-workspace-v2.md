# Payroll workspace and source detail

Payroll now separates overview, runs, employee payslips, pay elements, Odoo imports and settings. A parameterized, employee-scoped register unifies local and historical payslips with database pagination, source-copy deduplication and currency-separated totals. Specific local runs retain their local copies. Credit notes reverse positive totals. Detail preserves source amounts, quantities, rates and six-decimal totals; printing includes every category.

Employee compensation separates current contract terms from period payroll. Unverified legacy currency and missing fields remain explicit. Contract import resolves actual Odoo currency and discovers salary fields; legacy sync no longer hardcodes USD/SAR. Payroll-only jobs import contracts followed by historical payslips without requiring an optional loan module. Category ancestry supplies explicit salary-rule mappings, preserving existing mappings and rejecting unreconciled payslips.

Validation: TypeScript, ESLint, production build; payroll/workflow unit suites; isolated PostgreSQL unified-register and 501-employee historical-import integration tests (1,003 payslip lines); Chromium desktop/mobile navigation, filters, detailed earnings/deductions, PDF, creation and sync views with zero browser errors.

Production import on 2026-11-05 examined 2,098 source records: 1,721 contracts (93 created, 1,628 updated) and 307 detailed historical payslips imported. Of 308 accessible source payslips, one (Odoo #55320) failed strict gross/net reconciliation and remains staged for financial review. Another 69 contract records require employee matching or an explicit policy for the custom `Partial Stop` contract state. No duplicate accounts were reassigned, financial discrepancies overwritten, payroll approved/paid, or Odoo data changed. Errors remain visible with individual retry in the authenticated sync console.

Source GOSI employee deductions are separated from employer contributions and NGOSI reference subtotals. This follows inspected source rule definitions; it does not recompute historical insurance. Local payroll calculation also excludes historical Odoo payslip-line mirrors and rejects mixed-currency earning/deduction inputs.

The one-release expiring operator route and middleware exemption were removed after import. Its deployment environment secret and temporary deployments are deleted during final release verification. Future imports use the authenticated administrative console.
