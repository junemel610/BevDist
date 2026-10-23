# BevDist quality checks

Checked on 2026-10-24. This file distinguishes automated checks from actual screen/device inspection.

## Automated checks

- [x] ESLint for app code, configuration and tests: no errors or warnings.
- [x] TypeScript check for the project's TypeScript files. JavaScript screens are checked by ESLint, not full TypeScript checking.
- [x] 65 frontend tests pass.
- [x] Web JavaScript bundle exports successfully.
- [x] Android Hermes bundle exports successfully.
- [x] iOS Hermes bundle exports successfully.

Run from `mobileFrontend`:

```bash
npm run lint
npm run typecheck
npm test
npx expo export --platform all --output-dir /private/tmp/bevdist-quality-check
```

Bundle exports verify compilation. They do not install, launch, or visually inspect the native app.

## Visual and device checks still required

Automated UI access was unavailable: the native computer-use pipe failed, no browser provider was available, `xcrun simctl` was not installed, and `adb` was absent. No visual/device check below is marked complete.

Use a disposable test database and test operator account for transaction scenarios.

- [ ] Open at a small phone width (320–390 px) and desktop width. Check headings, bottom navigation, scrolling and text wrapping.
- [ ] Enable a larger device font size. Confirm labels and buttons remain readable without overlap.
- [ ] Login: show a clear wrong-password/network error; prevent duplicate submits; display the BevDist logo.
- [ ] Profile: refresh has its own indicator and does not show “Signing out”; sign-out requires confirmation.
- [ ] Create invoice: type `0.5`, `1` and `1.5`; clear a quantity; reject quarter cases and quantities above available stock.
- [ ] Invoice list, details and preview show delivery status independently of payment status.
- [ ] Open payment from unpaid and partially paid invoices. Amount starts at `0`; keyboard leaves fields and save action accessible.
- [ ] Verify oldest-invoice-first allocation is visible, including older invoices belonging to the customer.
- [ ] Save a cash payment; return to Dashboard and confirm today's cash value/chart updates. GCash and excess credit must not increase cash sales.
- [ ] Record delivery while partially paid: physical stock decreases once; final payment completes the invoice without another deduction.
- [ ] Inventory: Edit is visible in the card header; each case type retains its own stock/status.
- [ ] Stock notice appears near the top, includes available cases, can be dismissed, and View stock opens inventory. It should remain readable at a larger font size.
- [ ] With more than three customer credits, open the full searchable credit list; confirm names and amounts match their customer profiles.
- [ ] Add/edit/remove returned containers. Check the amount due and rejection of deductions below settlements already recorded.
- [ ] Export PDF and Excel on the phone, open/share both files, and compare return deductions, totals and balances to the invoice.
- [ ] Restart/reload the app, sign in again, and confirm records persist.

## Phone connectivity

The Expo Metro tunnel does not expose the API. For LAN testing, use the Mac's LAN address in frontend `.env.local` and bind the backend to the LAN intentionally. Port 5001 avoids the macOS AirPlay conflict found on port 5000:

```bash
# mobileBackend
HOST=0.0.0.0 PORT=5001 npm run dev
```

```dotenv
# mobileFrontend/.env.local
EXPO_PUBLIC_API_URL=http://YOUR_MAC_LAN_IP:5001
```

Restart Expo after changing the URL. Verify `/health` from the phone's browser before signing in. For web testing on the Mac, keep `http://127.0.0.1:5000` with the existing loopback backend configuration.
