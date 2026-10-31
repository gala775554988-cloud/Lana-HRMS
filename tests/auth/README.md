# Unified sign-in

Employees and administrators use the same username/national-ID and password form.
Ordinary employees use the last four digits of their national ID unless HR has set a custom password. Privileged accounts retain their configured password.
Device enrollment and biometric verification are no longer required for password sign-in. Existing authenticated device-management features remain available.

## Validation

```sh
node --experimental-vm-modules tests/auth/employee-login.test.mjs
npm run typecheck
```
