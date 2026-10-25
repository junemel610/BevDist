# Browser functionality checklist

The suite contains **48 scenarios**, each run on desktop Chromium and Pixel 7 browser emulation: **96 browser checks**. These cover the current web app workflows below. This is a feature checklist, not a claim that every possible input, browser or device behavior has been exhausted.

| Screen / function | Browser checks | Spec |
| --- | --- | --- |
| Login | Required fields, wrong credentials, successful sign-in, network retry, failed bootstrap hides private screens, expired/revoked session returns to login | `app`, `recovery` |
| Profile | Actual profile tab, refresh success/failure/retry, sign-out confirmation/cancellation, failed sign-out preserves the session | `app`, `recovery` |
| Navigation / Dashboard | Every main tab, quick-create opens modal directly, Supplier Orders / Outstanding Balances shortcuts, View All invoices | `app`, `payments-dashboard` |
| Dashboard calculations | Expected invoice value, cash actual sales, daily Cash / GCash / Bank Transfer values reconcile after browser payment saves; chart headings and rendered SVGs | `payments-dashboard` |
| Invoice creation | Existing and inline new customers, contact/address persistence, typed quantities, plus/minus half-case controls, empty cart, quarter-case and overstock rejection, confirmation cancellation, reload persistence | `app`, `invoices` |
| Invoice case packs | A / B / C / Mucho 6 / Mucho 12 each ordered through the browser at 0.5 case; direct case price, case quantities and separate reserved stock verified in persisted data | `invoices` |
| Pending invoices | Edit quantities, add follow-up products under the same invoice, preserve prior payment, cancel save, replace reservations, keep physical stock until delivery | `invoices` |
| Container returns | Editable label, half-case quantity, refund rate, partial return, invalid step, reject total below settlements, replace a return, explicitly clear all returns | `app`, `invoices` |
| Invoice cancellation | Confirm/cancel operation, release reservations, retain cancelled history, read-only cancelled details | `invoices` |
| Delivery / completion | Delivery before final payment; full payment before delivery; completed means delivered and fully paid; stock deducted once; completed details lack mutation actions | `app`, `invoices` |
| Invoice filters / search | Outstanding, fully paid, cancelled; search customer or invoice; no-match state and clear search | `invoices` |
| Payment entry points | From invoice details, invoice preview and Balances; starts at zero; modal close; method selection exposes checked state | `app`, `exports`, `payments-dashboard` |
| Payment validation | Zero/negative/excess decimal precision rejected; confirmation can be cancelled; real Cash / GCash / Bank Transfer saves; oldest invoice first | `app`, `payments-dashboard` |
| Customer credit | Excess excluded from applied sales, credit preserved, applied to a new invoice, names in credit list, search and no-match state | `app`, `payments-dashboard` |
| Balances | Paid/cancelled/unpaid/overdue filters and selected indicators; grouped customer invoices, historical balances, search and clear | `payments-dashboard` |
| GCash | Separate GCash stack, persisted receipt/invoice visible, back navigation from credit stack | `app` |
| Customer profiles | Create, required name, edit contact/address, cancel confirmation, persist updates, scroll through a virtualized customer list | `app`, `payments-dashboard` |
| Product creation | A/B/C, both Mucho types and custom case types; alphabet-only type names with bottle-count display; editable whole-number bottles per case; independent selling price and opening count; undo a newly added type before saving and remove an unused saved type; missing fields, duplicate name, invalid price/count, close without save | `inventory`, `product-entry` |
| Inventory editing | Quantity/price labels, reason required, invalid/reserved stock limits, atomic stale-count rejection and refresh | `app`, `inventory` |
| Stock presentation | Per-case Low stock labels, In stock / Low stock / Out of stock and supplier filters, search, clear and empty result | `inventory` |
| Product deletion | Confirmed zero-stock archive, refuse stocked/reserved product, preserve completed invoice snapshots/history | `app`, `inventory` |
| Supplier drafts | Select supplier, picker close, add/remove lines, empty and quarter-case rejection, reject mixed valid/invalid lines, confirm/cancel supplier switch before clearing draft | `suppliers` |
| Supplier receipts | Existing/new supplier, multiple new products in one receipt with no returns, manual return credits, multi-product half-case receipt, confirmation cancellation, all four return types deduct credit, separate case stock, recent receipt opens/closes details | `app`, `suppliers`, `product-entry` |
| Feedback | Top stock notification, current stock message actions, dismiss and View stock navigation | `invoices` |
| Excel export | Actual browser download, XLSX filename, parse downloaded workbook, customer/invoice/product/case/refund values and merged layout | `exports` |
| PDF / print | Invoice-only print window with formatted table, actual Chromium PDF bytes, no app tabs in print window, blocked-popup error leaves preview usable | `exports` |
| Duplicate saves | Original request deliberately held; busy state visible, repeated submission rejected, one persisted customer after release | `recovery` |
| Save / read recovery | Real write succeeds but response is lost; real write succeeds but refresh fails; saves unavailable behind recovery gate; refresh failure/retry; exactly one saved record | `recovery` |

Spec names above omit `.spec.cjs`. Files and scenario counts:

| Spec | Scenarios per browser size |
| --- | ---: |
| `app.spec.cjs` | 6 |
| `exports.spec.cjs` | 3 |
| `inventory.spec.cjs` | 6 |
| `invoices.spec.cjs` | 10 |
| `payments-dashboard.spec.cjs` | 6 |
| `product-entry.spec.cjs` | 8 |
| `recovery.spec.cjs` | 6 |
| `suppliers.spec.cjs` | 3 |
| **Total** | **48** |

## What is real and what is injected

Normal workflows run against the actual exported application, navigation container, Express routes and disposable PostgreSQL database. API helpers prepare independent fixture records and inspect persisted results; the operation under test is submitted from the browser. No production records are used.

Recovery tests explicitly intercept selected requests to simulate disconnects, an unconfirmed response after a real write, a failed read or a delayed save. The blocked-popup test replaces `window.open`. The PDF test suppresses the operating-system print dialog, verifies the actual invoice HTML, and creates a PDF using Chromium's print renderer. It does not automate clicking “Save as PDF” in the system dialog or verify native Expo file sharing.

Native Android/iOS execution, Safari/Firefox compatibility, physical keyboards/safe areas, screen-reader announcements on real devices, pixel comparison baselines and list-performance benchmarks remain outside this browser suite. Database constraints, malicious API payloads, concurrency and login rate limiting also have dedicated backend tests; they are not duplicated exhaustively in Playwright.

See [README.md](README.md) for running the interactive UI and viewing reports. Restart an already-open Playwright UI after app code/configuration changes so its web export is rebuilt.
