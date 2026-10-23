# Playwright browser tests

Tests open the real Expo web application in Chromium and use a real Express API and PostgreSQL database. API calls prepare independent customers/products; browser actions submit the operation being tested. Normal workflows use real requests. Recovery tests explicitly inject network failures or delays; export tests also control popup/print-dialog boundaries.

## Setup and run

Install dependencies in both `mobileFrontend` and `mobileBackend`. PostgreSQL must be running and backend `.env` must contain a working `DATABASE_URL` whose role can create databases. From `mobileFrontend`:

```bash
npx playwright install chromium       # once per machine / Playwright browser update
npm run test:e2e                      # headless desktop + phone-sized Chromium
npm run test:e2e:ui                   # interactive runner, pick tests and inspect each step
npm run test:e2e:headed               # watch the test browser
npm run test:e2e:report               # open the last HTML report
npm run test:e2e -- --project mobile-chromium
```

The servers start automatically. Leave ports **5017** and **8087** free; Playwright deliberately refuses to reuse an existing server. A normal backend or Expo session on other ports can remain running. The frontend is a production web export; restart the Playwright UI runner after changing app source so the export rebuilds.

`node scripts/test-all.mjs` from `Project` also runs this suite after the unit/component/database checks.

To run alongside an existing UI session, use separate ports (builds, screenshots and reports are isolated too):

```bash
BEVDIST_E2E_API_PORT=5018 BEVDIST_E2E_WEB_PORT=8088 npm run test:e2e
npx playwright show-report dist/e2e-5018-8088/playwright-report --host 127.0.0.1
```

Default runs still use `dist/playwright-report`. Alternate-port runs use `dist/e2e-<API port>-<web port>/playwright-report`. Both ports must be distinct valid port numbers.

## Isolation

`server.cjs` creates a uniquely named `bevdist_e2e_*` database, applies the existing migrations and creates a test-only operator. It drops only that generated database during normal shutdown. It never migrates, seeds or deletes the application database. The credentials in `settings.cjs` work only in this disposable database; they are not production credentials.

`web.cjs` exports the app with `EXPO_NO_DOTENV=1` and the test API URL, clears the Metro export cache, then serves that output on loopback. This avoids SDK 57's development environment module overriding the test URL with a developer's `.env.local`. Browser requests outside the test web/API origins are blocked as an additional safeguard.

The test API trusts forwarded IPs from loopback only, and each simulated client receives its own test IP. This keeps independent browser runs from sharing one login-throttle bucket. Production middleware and its rate limit are unchanged; rate limiting itself remains covered by the backend suite.

Tests run with one worker and give each scenario unique fixture names. Never point these scripts at an existing test/production API. Normal shutdown cleans up the database. A forced kill, power loss or database outage can leave a `bevdist_e2e_*` database for manual review/removal; the runner never deletes databases from prior runs.

## Scenarios

There are **40 scenarios**, run at two browser sizes for **80 checks**. See the [screen-by-screen functionality checklist](COVERAGE.md) for invoice lifecycle, all case packs, payments, returns, CRUD operations, filters, exports and failure recovery.

Each scenario runs at desktop and Pixel 7 browser sizes. This is mobile **web emulation**, not native Android or iOS testing. Native file sharing, device safe areas/keyboard behavior, performance and visual design approval remain separate checks. See `Project/TEST_COVERAGE.md` for the broader test matrix.

Reports, failure screenshots and traces are saved under ignored `mobileFrontend/dist/playwright-*` directories. Traces contain test fixture data and test session tokens; do not publish them as production diagnostics.

Configuration follows Playwright's [web server](https://playwright.dev/docs/test-webserver) and [UI mode](https://playwright.dev/docs/test-ui-mode) documentation.
