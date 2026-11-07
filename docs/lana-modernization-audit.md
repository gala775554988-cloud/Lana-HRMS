# Lana HR modernization audit

This is a source audit and work tracker for the isolated modernization branch. Existing accounts, database schema, production configuration and Odoo jobs are outside the execution scope. Automated verification must use fixtures or a disposable synthetic database.

| Area | Source finding or current capability | Verification still needed |
| --- | --- | --- |
| Employee account | Settings previously posted a two-factor flag without implementing a corresponding authentication challenge. The settings page also queried the session table although sign-in uses JWTs. The revised overview links to implemented features and separates sign-in identity from employment details. | Existing account login, credential recovery, image changes and authorization across roles in a browser using synthetic accounts. |
| Preferences | The API previously passed an unrestricted JSON body to Prisma. The revised contract validates fields and resolves ownership from the session. Appearance and language now use the existing browser preference mechanisms. | Browser persistence, Arabic and English, RTL and LTR, mobile and desktop. |
| Navigation and design | Both portals have separate shells. Admin search was hidden on narrow screens. The shell now exposes it on mobile and adapts to the dynamic viewport. Browser zoom is allowed. | Full navigation and usability audit with keyboard, touch, screen readers, dark mode and narrow widths. |
| Requests and leave | Existing routing, cancellation, review and leave debit have mock coverage. | Browser coverage of the employee journey, approval queues, status history and attachments. |
| Permissions | Existing role templates and scoped permissions coexist with role-specific routes. | Map direct URLs, API operations, record scope and exports against a synthetic role matrix, including role revocation and delegated approvals. |
| Payroll and benefits | Existing payroll lifecycle includes CAS transitions and a downstream accounting path. | Validate the roles and approval states with isolated stubs, then exercise employee salary views, final reports and export access. |
| Attendance | The global Permissions-Policy denies location while the employee attendance UI requests it. | Resolve document-level policy for client navigation and test permission outcomes and site restrictions on mobile. |
| Employee operations | Tasks, documents, assets, training, performance, complaints, advances, loans and notifications have existing routes. | Inventory missing end-to-end actions and verify their visibility, validation and empty/error states. |
| Admin operations | Organization, contracts, recruitment, reporting, announcements and settings have existing routes. | Audit workflows, exports, scoped visibility, keyboard and mobile operation. |
| Build | The Vercel build script previously ran database schema and hospital population scripts. The branch separates these operations from the build. | Generate Prisma and build in a sandbox with the necessary binaries, then run browser smoke tests with synthetic accounts. |
