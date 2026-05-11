# Personal Dashboard

A local-first Electron desktop app for tracking net worth, mortgage/equity, device health, and site uptime. All data lives in SQLite on your machine. No cloud required.

Built with Electron 42, React 19, Tailwind CSS v4, shadcn/ui, Drizzle ORM, and better-sqlite3.

---

## Prerequisites

- **Node.js 22+** (check: `node --version`)
- **npm 10+**
- macOS is the primary platform; Windows and Linux are supported but less tested.

---

## First-time setup

### 1. Install dependencies

```bash
npm install
```

### 2. Apply the better-sqlite3 V8 patch

Electron 42 uses a V8 sandbox API that better-sqlite3 12.x hasn't upstreamed support for yet. After every `npm install` you must rebuild better-sqlite3 for Electron's Node ABI:

```bash
npm run rebuild
```

If the rebuild fails with V8 errors (`v8::External::New`, `SetNativeDataProperty`), the patch in `node_modules/better-sqlite3/src/` needs to be reapplied. See **Troubleshooting** below.

### 3. Generate and run the initial migration

This step uses system Node (not Electron) to push the schema to SQLite:

```bash
npm run db:generate   # only needed if schema changed
npm run db:migrate
```

The database file lives in your OS user-data directory (macOS: `~/Library/Application Support/personal-dashboard/`).

### 4. Start the app

```bash
npm run dev
```

---

## Daily use

### Net worth

- **Add account** — click the button in the top-right. Choose asset or liability, enter a starting balance, and the app records a snapshot with `recorded_at = now()`.
- **Update balances** — opens a fast-entry modal listing every manual account. Edit values and save; a new snapshot row is written for each changed account.
- Click any account row to open a drawer with its full balance history and the source of each snapshot (manual or Plaid).

### Mortgage

- First time: click **Add mortgage** to enter your loan details (principal, rate, term, start date).
- Optionally add a property record to unlock the Property hero (home value, equity, 12-month equity trend).
- Use the **Payoff scenarios** tab to model extra monthly payments, a one-time lump sum, or biweekly conversion. Results update live (debounced 200 ms) without any IPC round-trip.
- Click **Update home value** to record a manual valuation snapshot.

### Sites

- **Add site** — name, URL, check interval (default 5 min), and optional slow-response threshold.
- The monitor runs background checks while the app is open. It fires a system notification on status transitions (up → down and down → up), not on every check.
- Click a row to see the last 24 h status timeline and a 7-day response-time chart.
- Pause, edit, or delete a site from its row menu.

> **Note:** Site monitoring only runs while the app is open. If you need 24/7 monitoring, `electron/main/monitors/site-monitor.ts` has no Electron-specific imports and can be ported to a standalone Node service against the same SQLite file.

### Devices

- **Add device** — gives you a fresh agent token and a one-liner curl command to test the connection.
- Status dots: green = reported in the last 60 s, amber = last hour, red = longer ago or never.
- Click a device card to see metrics and copy the agent install instructions.

#### Installing an agent

Copy the relevant script from `agents/` to each machine:

| Script | Platform | Scheduler |
|---|---|---|
| `agents/macos-agent.sh` | macOS | launchd |
| `agents/linux-agent.sh` | Linux | systemd timer |
| `agents/windows-agent.ps1` | Windows | Task Scheduler |

Each script reads two environment variables:

```bash
export AGENT_TOKEN=<token-from-add-device-dialog>
export DASHBOARD_HOST=http://<dashboard-machine-ip>:53117
```

For devices on a different network, route through Tailscale — the agent server only needs to be reachable, NAT traversal is your concern.

### Settings

| Section | What you can do |
|---|---|
| Theme | Dark / Light / System |
| Data | Export all data as JSON; open the SQLite data folder |
| Integrations | Shows Plaid (Phase 2) and home-value API (Phase 2) placeholders; device agent server port |
| Alerts | System notifications for site state changes (always on) |
| About | App version, database type |

---

## Database management

```bash
npm run db:generate   # generate a new migration from schema changes
npm run db:migrate    # apply pending migrations (system Node, not Electron)
npm run db:studio     # open Drizzle Studio in the browser
```

Migrations live in `electron/main/db/migrations/`. The app runs them automatically on startup in production, but only if the migrations folder is present.

---

## Building for distribution

```bash
npm run build:mac     # → release/<version>/*.dmg + *.zip
npm run build:win     # → release/<version>/*.exe (NSIS)
npm run build:linux   # → release/<version>/*.AppImage + *.deb
```

`electron-updater` is wired but inert — no update server is configured yet.

---

## Running tests

```bash
npm test          # watch mode
npm run test:run  # single pass (CI)
```

Mortgage math (`src/lib/mortgage.ts`) has 100% branch coverage. All functions in `src/lib/` are unit-tested.

---

## Project structure

```
personal-dashboard/
├── electron/
│   ├── main/
│   │   ├── index.ts              # app lifecycle, BrowserWindow, IPC registration
│   │   ├── ipc/                  # one file per domain (accounts, mortgage, sites, devices, settings)
│   │   ├── db/
│   │   │   ├── client.ts         # better-sqlite3 + Drizzle instance
│   │   │   └── migrations/       # drizzle-kit output
│   │   ├── monitors/
│   │   │   ├── site-monitor.ts   # node-cron site checks + system notifications
│   │   │   └── device-server.ts  # HTTP server agents POST to (port 53117)
│   │   └── integrations/
│   │       ├── plaid.ts          # Plaid client stub (Phase 2)
│   │       └── home-value.ts     # home-value provider stub (Phase 2)
│   └── preload/
│       └── index.ts              # contextBridge — exposes typed window.api
├── shared/
│   ├── db/schema.ts              # Drizzle schema, single source of truth
│   ├── ipc/contracts.ts          # Zod schemas for every IPC channel
│   └── types.ts                  # TypeScript types derived from Zod schemas
├── src/                          # renderer (React)
│   ├── components/
│   │   ├── ui/                   # shadcn/ui output
│   │   ├── layout/               # AppShell, Sidebar
│   │   └── charts/               # NetWorthTrend, AmortizationChart (Recharts)
│   ├── routes/                   # TanStack Router file-based routes
│   │   ├── index.tsx             # Overview
│   │   ├── net-worth.tsx
│   │   ├── mortgage.tsx
│   │   ├── devices.tsx
│   │   ├── sites.tsx
│   │   └── settings.tsx
│   ├── hooks/                    # TanStack Query wrappers (useAccounts, useMortgage, …)
│   └── lib/
│       ├── mortgage.ts           # pure amortization math
│       └── formatters.ts         # currency, date, percent formatters
├── agents/                       # reference agent scripts
│   ├── macos-agent.sh
│   ├── linux-agent.sh
│   └── windows-agent.ps1
├── scripts/
│   └── migrate.ts                # run migrations with system Node
├── electron.vite.config.ts
├── drizzle.config.ts
└── package.json
```

---

## Phase roadmap

### Phase 1 — MVP (complete)

Manual-entry-only. All pages functional. Mortgage calculator with unit-tested math. Site monitoring. Device agent server. Settings with theme and data export.

### Phase 2 — Plaid + home value

- Plaid Link flow; hourly balance + transaction sync.
- Spending exploration tab on Net Worth (category breakdown, top merchants, date filter).
- Plaid account → manual account merge in Settings.
- Home-value provider integration (Zillapi / RapidAPI), opt-in via Settings.

### Phase 3 — Device monitoring (partially done in Phase 1)

- Full device drawer with 24 h CPU/RAM/disk charts.
- Metrics history table (rolling window).

### Phase 4 — Polish

- Alert rules with configurable thresholds per site/device.
- Scheduled SQLite backups.
- CSV export per page.
- Auto-update wiring.
- Virtualised lists for large datasets.

---

## Troubleshooting

### `NODE_MODULE_VERSION` error after `npm install`

better-sqlite3 12.x needs three source patches to compile against Electron 42's V8 sandbox. The patches touch `node_modules/better-sqlite3/src/` (three sites: `v8::External::New` needs a third tag arg, `->Value()` needs a tag, `SetNativeDataProperty` has an ambiguous nullptr). After patching:

```bash
npm run rebuild
```

This is the only known setup friction. An upstream PR is open; once it lands the patch step goes away.

### App opens but shows a blank screen

Run `npm run dev` from the project root and check the terminal for Vite or Electron errors. If the renderer fails to load, the preload IPC bridge is likely missing — make sure `npm run rebuild` succeeded.

### Migrations not found on first launch

If you see a migration error on cold start, run `npm run db:migrate` manually before launching the app. Production builds bundle the migrations folder automatically.

### Drizzle Studio can't connect

Drizzle Studio uses system Node's `better-sqlite3`, which has a different ABI than the Electron-rebuilt one. If it crashes, use the **Settings → Open data folder** button and inspect the SQLite file with any SQLite browser instead.
# personal-dashboard
