# Employee sign-in with email verification

Ordinary linked employee accounts (EMPLOYEE role only, or no role) sign in with their national ID and its last four digits, followed by a mandatory six-digit email code. Accounts with other roles keep their existing password. Existing password hashes are preserved. Device UUIDs no longer bind accounts or block login/attendance. Historical device rows remain for explicit administrative cleanup and push-notification compatibility. Twilio is no longer used by this login flow.

## Delivery setup

The app uses the Resend HTTPS API, without adding a package dependency. Resend offers a limited free tier; confirm current quotas and eligibility with the provider. A free tier does not provision an account or credentials automatically. Configure:

- `RESEND_API_KEY`: enter securely in environment settings (or configure proxy injection for `api.resend.com`). Do not commit or log it.
- `OTP_EMAIL_FROM`: an authorized sender on a domain verified with Resend, e.g. `Lana HRMS <login@your-domain>`. Do not copy the example as a working sender. Resend's test sender restricts recipients and cannot deliver to all employees.
- `AUTH_SECRET` or `NEXTAUTH_SECRET`: retain the configured private authentication secret; codes are protected by HMAC with that key.
- Permit HTTPS to `api.resend.com`.

The destination is the saved `User.loginEmail`. On first sign-in the employee proposes an email: it must match the HR-recorded `Employee.email`, or the employee must present an unexpired private activation code issued by HR. The address is saved only after OTP verification. A submitted address never overrides an existing saved login email. Placeholder `.local`, `.invalid`, `.test` and example-domain addresses are rejected. Missing mail settings or a missing employee address block login with an HR support message; there is no bypass or debug-code endpoint. A provider accepting the request is not proof that it reached the recipient's inbox.

## Security and compatibility

Codes are cryptographically random, expire after five minutes and work once. Only a keyed digest, random nonce and destination digest are stored in the existing `VerificationToken` table; the plaintext code is sent only in the provider request. Atomic database claims limit sends to one per calendar minute and five per ten-minute window, and checks to five attempts per challenge, across application instances. Changing the saved login email invalidates an outstanding code. Successful verification atomically consumes the challenge; racing requests cannot both establish sessions with it. OTP is enforced in Auth.js Credentials.authorize, including direct Auth.js requests. Apply the new `20261028000100_employee_login_enrollment` migration before deploying this version; it adds separate login-email, verification, password-mode and session-version fields to User. Employees are no longer forced to change the four-digit login value; administrative password rules remain.

## Validation

```sh
node --experimental-vm-modules tests/auth/employee-login.test.mjs
npm run lint
npm run typecheck
npm run build
```

Eleven isolated regression tests execute real source modules with simulated database/provider adapters. They cover employee/admin password behavior, unavailable delivery, invalid email addresses, code binding, expiry and atomic single-use, attempt exhaustion, concurrent send throttling and provider failure, shared browser use, and Credentials-provider enforcement. These tests and lint passed during implementation. Live mail delivery was not tested: no Resend credentials or approved sender were present. Prisma generation, type checking, lint, and the production build passed after the network settings were applied.

After configuring delivery and applying the network settings, run the complete setup and validation, then test a controlled employee login against a real registered mailbox, wrong/expired/reused codes, logout and switching accounts in the same browser, and an administrative password login. Do not claim production readiness from mocked tests alone. Existing seeded employee placeholders need a real HR-managed email before an end-to-end login test can run. Legacy Twilio environment rows may still appear in settings because the draft tool cannot remove variable requirements; they are unused and need no values for this implementation.

## First sign-in and account administration

The first sign-in asks for an email once after the account password is checked. If the proposed email differs from HR's recorded email (or none is recorded), require a private activation code. HR checks the employee's identity independently and issues that code from **Employees → Manage employee accounts and passwords** (`/employees/password-management`). Invitation codes use 256 random bits, are stored only as a hash, expire after seven days, and are removed once email enrollment succeeds. They are never audit-logged. The separate login address survives Odoo changes to the employee's work email. Each subsequent login sends the OTP to the saved address without asking the user to type it again.

HR managers can edit ordinary employees' username, login email, active state and password. A custom password replaces the ID suffix; an explicit restore action returns to the suffix. Super administrators can edit other privileged linked accounts, but those accounts never switch to suffix/employee activation. Self-account edits are excluded from this management route. Account writes, pending-OTP/invitation invalidation and audit events run in one transaction; audits record changed field names rather than passwords, email addresses or activation codes. Updating an account increments its session version, and the JWT callback rejects inactive or stale sessions. Password reset through the older bulk screen now selects custom-password mode so generated passwords actually work with the new login path.

Apply `npm run prisma:generate` and `npm run prisma:deploy` before starting the app. On 2026-10-28 the four additive User columns and the unique login-email index were applied to the production database through an authorized, bearer-protected temporary runtime migration endpoint, then verified against the same connection used by the app. The versioned SQL is idempotent so a later normal Prisma migration deployment can record it in the migration ledger. Regression tests include activation ownership/expiry, refusing arbitrary new email binding, atomic enrollment and stale-version protection, custom password precedence, account-management permissions and actual API behavior with simulated adapters. Prisma generation and full application type checking passed. HTTP smoke checks on production confirmed the login form, Auth.js provider/session endpoints, rejection of invalid credentials and unauthenticated employee-data requests. Live delivery and a real employee end-to-end login remain unverified: Resend settings are absent and the configured Odoo account denied mail-model access. No OTP bypass was enabled.
