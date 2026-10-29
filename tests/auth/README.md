# Employee device sign-in

Employees enter their ten-digit national ID and its last four digits. A separate step opens the device's WebAuthn prompt for a fingerprint, face recognition or device unlock PIN. Administrator and custom-password sign-in remains available through the separate password toggle. Privileged accounts keep their password flow.

There are no HR activation PINs in the login flow or account-management UI/API. Existing activation tokens are not accepted. The account-management API rejects the removed issuance field rather than silently issuing a new code.

For an active employee account with no registered credential, the checked ID suffix (or configured custom password) bootstraps first-device enrollment. Enrollment must finish with a verified WebAuthn registration response before Auth.js creates a session. This intentionally removes the previous independent HR-issued credential from initial enrollment. Accounts with an existing device must authenticate with that credential; knowing the ID suffix does not permit replacing it or registering another first device. Additional devices can be registered through the existing authenticated registration endpoints.

Login and first-enrollment challenges have distinct purposes, expire after two minutes, require device user verification, and bind to the account version. Enrollment serializes per account, atomically consumes the challenge, and refuses an already-enrolled account. Login verifies account ownership and atomically consumes its challenge. Canceling or failing either ceremony never creates a session.

## Validation

```sh
node --experimental-vm-modules tests/auth/employee-login.test.mjs
npm run typecheck
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npx playwright test -c tests/smoke/playwright.config.ts auth.spec.ts --grep 'identity check|employee login starts'
```

The isolated authentication suite covers credential checks, legacy-code rejection, registration/authentication enforcement, expired and stale challenges, replay/concurrent consumption, first-device-only enrollment and account-management permissions. Legacy email helpers retain their isolated tests but do not participate in employee device sign-in. Chromium tests verify the initial two-field screen, password-login toggle and separate device-verification step without activation fields; the transition test mocks the server-action transport. Physical device verification requires an actual registered device.
