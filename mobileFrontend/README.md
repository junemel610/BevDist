# BevDist POS — Mobile Frontend

React Native mobile application for the Jojo's Coke Beverage Distribution POS system, built with Expo.

## Setup

```bash
npm install
npm start
```

Then press:
- `i` to open iOS simulator
- `a` to open Android emulator
- `w` to open web preview

## Project Structure

```
src/
├── api/              # API service layer (axios client + endpoints)
├── context/          # React Context for global state
├── screens/          # Screen components (Dashboard, Orders, etc.)
├── components/       # Reusable UI components
├── types/            # TypeScript types and constants
└── hooks/            # Custom React hooks
```

## Development

Follow the `bevdist-stack` skill in the parent `.claude/skills/` directory for guidance on:
- Component patterns
- API integration
- State management
- Error handling

## Environment

Create a `.env` file in the root:

```
EXPO_PUBLIC_API_URL=http://127.0.0.1:5000
```

Use the ignored `.env.local` for machine-specific settings. `EXPO_PUBLIC_*` values are bundled into the client; never put database credentials or server secrets there.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
```

For browser UI testing, first run `npx playwright install chromium`, then `npm run test:e2e:ui` for the interactive runner or `npm run test:e2e` for headless desktop/mobile web checks. The test servers start automatically and PostgreSQL must be running. See [Playwright testing](tests/e2e/README.md) for setup and reports, and the [functionality checklist](tests/e2e/COVERAGE.md) for all 40 scenarios (80 desktop/mobile checks). Restart an existing Playwright UI session after code changes to rebuild its test app.

Lint covers app code and tests and rejects warnings. Type checking covers the existing TypeScript files; JavaScript screens are linted. See [QA_CHECKLIST.md](QA_CHECKLIST.md) for the verified bundle exports and the remaining visual/device checks.

The app uses React Navigation through `App.js` and `src/navigation/RootNavigator.js`. Unused Expo Router starter tabs and sample splash components were removed; do not restore them as a fix for navigation errors.

Run `node scripts/test-all.mjs` from `Project` for frontend lint, types, unit/component tests, backend database tests and Playwright browser tests. See [TEST_COVERAGE.md](../TEST_COVERAGE.md) for the feature matrix, database requirements and coverage limits. Jest reports are generated in `dist/test-coverage/ui/`.
