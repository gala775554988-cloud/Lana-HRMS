# ZKBio Time -> Lana HRMS attendance sync (local Windows script)

Polls ZKBio Time's REST API from a machine on the same local network as the
device (192.168.0.253), and relays new punches to Lana HRMS over HTTPS. It
makes no inbound connections and opens no ports -- safe to run on a normal
office Windows PC.

## 1. Requirements

- Node.js 18 or newer installed on the Windows machine. Check with:
  ```
  node --version
  ```
  If that fails, install it from https://nodejs.org (choose the LTS installer).
- No `npm install` needed -- the script has zero dependencies.

## 2. Where the config file goes

Copy `scripts/zkbio-attendance-sync.env.example` to a new file **in the same
folder**, named exactly:

```
scripts/zkbio-attendance-sync.env
```

(This file is git-ignored -- it will never be committed, since it holds
secrets.) Open it and fill in:

- `ZKBIO_USERNAME` / `ZKBIO_PASSWORD` -- your real ZKBio Time login.
- `ZKBIO_SYNC_TOKEN` -- make up a long random string (e.g. run
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
  and set the **same** value as the `ZKBIO_SYNC_TOKEN` environment variable in
  Vercel's project settings (Settings -> Environment Variables) for the Lana
  HRMS project. This is the shared secret between this script and the
  `/api/attendance/zkbio-sync` route -- without it matching on both sides, the
  Vercel route will reject every request with 401.
- Leave `ZKBIO_URL`, `ZKBIO_LOGIN_PATH`, `ZKBIO_TRANSACTIONS_PATH` as-is
  unless you've confirmed (via your browser's DevTools Network tab while
  logging into ZKBio Time) that the real paths differ.

## 3. Run it manually once, to test

Open Command Prompt or PowerShell, navigate to the project folder, then:

```
node scripts\zkbio-attendance-sync.mjs
```

Watch the output:
- `Polling ZKBio Time transactions from ... to ...` -- confirms it started.
- `Sent N record(s) to Lana. Response: ...` -- success.
- Any line starting with `WARNING:` -- the script detected something that
  didn't match the expected ZKBio Time API shape (login response fields, or
  the transactions list format). It logs exactly what it received so this can
  be fixed precisely instead of guessing. Copy that warning text if you need
  it adjusted.
- A line starting with `FATAL:` -- the run failed outright (e.g. wrong
  username/password, ZKBio Time unreachable, wrong `ZKBIO_SYNC_TOKEN`).

Re-running it is safe: it only asks ZKBio Time for transactions since its
last successful run (tracked in `scripts/zkbio-attendance-sync.state.json`,
also git-ignored), and the Vercel side does not create duplicate attendance
rows even if the same punch is sent twice.

## 4. Schedule it to run automatically every 10-15 minutes (Windows Task Scheduler)

1. Press `Win`, type **Task Scheduler**, open it.
2. In the right-hand panel, click **Create Task...** (not "Basic Task" --
   the full dialog gives more control).
3. **General tab:**
   - Name: `Lana ZKBio Attendance Sync`
   - Select **Run whether user is logged on or not**.
   - Check **Run with highest privileges**.
4. **Triggers tab:**
   - Click **New...**
   - Begin the task: **On a schedule**.
   - Settings: **Daily**, start time = now.
   - Check **Repeat task every:** and choose **15 minutes**.
   - **for a duration of:** choose **Indefinitely**.
   - Click OK.
5. **Actions tab:**
   - Click **New...**
   - Action: **Start a program**.
   - Program/script: the full path to `node.exe` (find it by running
     `where node` in Command Prompt, e.g.
     `C:\Program Files\nodejs\node.exe`).
   - Add arguments: the full path to the script, e.g.
     `C:\path\to\Lana-HRMS\scripts\zkbio-attendance-sync.mjs`
   - Start in (optional but recommended): the project folder, e.g.
     `C:\path\to\Lana-HRMS`
   - Click OK.
6. **Conditions tab:**
   - Uncheck **Start the task only if the computer is on AC power** (so it
     keeps running on a laptop on battery too, if relevant).
7. **Settings tab:**
   - Check **Allow task to be run on demand**.
   - Check **If the task fails, restart every:** 5 minutes, up to 3 times.
8. Click **OK**, enter the Windows account password if prompted.

### Confirm it's actually running

- Right-click the task in Task Scheduler -> **Run** to trigger it immediately,
  then check **History** tab (enable "Enable All Tasks History" from the
  Action menu on the left if History is empty) for the "Task completed"
  event.
- Or just wait 15 minutes and check the Vercel HRMS logs / AuditLog entries
  (action `ZKBIO_ATTENDANCE_SYNC`) for a new run.

### If it stops working

- Open Task Scheduler, find the task, check **Last Run Result** -- a
  non-zero code means the script exited with an error; re-run it manually
  (step 3) to see the actual error message.
- The task is configured to survive a machine reboot as long as the "Run
  whether user is logged on or not" option was selected in step 3.
