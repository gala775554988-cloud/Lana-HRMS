# Payroll workspace and source detail

Payroll now separates overview, runs, employee payslips, pay elements, Odoo imports and settings. A parameterized, employee-scoped register unifies local and historical payslips with database pagination, source-copy deduplication and currency-separated totals. Specific local runs retain their local copies. Credit notes reverse positive totals. Detail preserves source amounts, quantities, rates and six-decimal totals; printing includes every category.

Employee compensation separates current contract terms from period payroll. Unverified legacy currency and missing fields remain explicit. Contract import resolves actual Odoo currency and discovers salary fields; legacy sync no longer hardcodes USD/SAR. Payroll-only jobs import contracts followed by historical payslips without requiring an optional loan module. Category ancestry supplies explicit salary-rule mappings, preserving existing mappings and rejecting unreconciled payslips.

Validation: TypeScript, ESLint, production build; payroll/workflow unit suites; isolated PostgreSQL unified-register and 501-employee historical-import integration tests (1,003 payslip lines); Chromium desktop/mobile navigation, filters, detailed earnings/deductions, PDF, creation and sync views with zero browser errors.

Production import outcome and final deployment are recorded after execution. The temporary expiring operator route and its secret are removed after import; it permits no Odoo writes, payroll approvals, payments or arbitrary database operations.
