Run `npm run test:payroll-responsive` after installing project dependencies.
Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if Chromium is not at `/usr/bin/chromium`.

The harness bundles production payroll client components and the generated document template,
then supplies synthetic API responses. It checks 320, 390, 768, 1024, and 1440 pixel widths,
card and table layouts, earnings/deductions filtering, all-line printing, report error/retry,
and browser errors. It produces screenshots, two PDFs, and results under
`/tmp/payroll-responsive` (override with `PAYROLL_SCREENSHOTS`).

Navigation hooks and links are replaced with local adapters. This is a component and
viewport check; authentication, database access, and live payroll writes are not exercised.
No real payroll or employee data is used or modified.
