# Current test coverage

[Repository overview](../../README.md) · [Development and deployment](../README.md)

Run commands inside the relevant app directory. Counts below reflect the current checked-in tests; update this guide when suites change.

## Here!

From `apps/here/`: run `npm test`, `npm run lint`, and `npm run build`. Run `npm run test:e2e` for browser tests with Auth and Realtime Database emulators (Firebase CLI, JDK 21+, and Playwright Chromium required). The emulator project ID is `demo-here`; tests do not use the production database.

| File | Cases | Coverage |
| --- | ---: | --- |
| [class-attendance.test.mjs](../../apps/here/tests/class-attendance.test.mjs) | 5 | On-time/late status, grace periods, timezones, invalid times. |
| [class-schedule.test.mjs](../../apps/here/tests/class-schedule.test.mjs) | 4 | Recurring sessions, 30-minute cutoff, weekdays, daylight saving. |
| [guest-account.spec.mjs](../../apps/here/tests/guest-account.spec.mjs) | 3 | Guest class settings, account conversion, and session ending. |
| [teacher-auth.spec.mjs](../../apps/here/tests/teacher-auth.spec.mjs) | 2 | Teacher sign-in, account form, and guest entry. |
| [username.test.mjs](../../apps/here/tests/username.test.mjs) | 3 | Normalization, allowed characters, internal auth identifiers. |

## Passdown

From `apps/passdown/`: run `npm test` (unit + React component tests), `npm run lint`, and `npm run build`. Run `npm run test:rules` for Firestore security tests with the `demo-passdown` emulator project (Firebase CLI and JDK 21+ required).

| File | Cases | Coverage |
| --- | ---: | --- |
| [tests/deals.test.mjs](../../apps/passdown/tests/deals.test.mjs) | 9 | Offers, participant actions, reservations, completion, pickup validation, and dashboard groups. |
| [tests/listings.test.mjs](../../apps/passdown/tests/listings.test.mjs) | 5 | Whole-dollar prices, free listings, dates, categories, photos, and archived listings. |
| [tests/model.test.mjs](../../apps/passdown/tests/model.test.mjs) | 13 | Search, category/school filters, URLs, profile validation, availability, initials, and safe sign-in paths. |
| [tests/photoUpload.test.mjs](../../apps/passdown/tests/photoUpload.test.mjs) | 4 | Cloudinary requests, config and file checks, error handling, and failed-save cleanup. |
| [tests/rules/deals.rules.test.mjs](../../apps/passdown/tests/rules/deals.rules.test.mjs) | 14 | Offer validation, participant access, atomic item reservations, cancellations, sale completion, pickup confirmation, and messages. |
| [tests/rules/firestore.rules.test.mjs](../../apps/passdown/tests/rules/firestore.rules.test.mjs) | 10 | Profile ownership and validation, public browsing, listing ownership, and default-deny access. |

Passdown currently has **91 tests**: 31 unit cases, 36 React component cases, and 24 Firestore rule cases. Negative security tests deliberately produce permission-denied emulator logs; success means the test runner exits with zero failures.

The table above covers domain logic and Firebase rules. The React component suite below renders the actual screens. The old lending/loan tests are no longer part of the resale app.

### React component coverage

Run `npm run test:components` for a single pass, or `npm run test:components:watch` while developing. `npm run test:unit` runs only the original Node tests. The CI workflow runs `npm test`, which includes both unit and component suites.

| Component suite | Cases | User flows |
| --- | ---: | --- |
| [account.test.jsx](../../apps/passdown/tests/components/account.test.jsx) | 7 | Google sign-in, busy state, safe return navigation, errors/retry, cancelled popup, profile access, validation/save, sign-out |
| [browse.test.jsx](../../apps/passdown/tests/components/browse.test.jsx) | 4 | Combined search/school/category filters, shared URL state, clearing filters, item navigation, empty inventory, read errors |
| [listings.test.jsx](../../apps/passdown/tests/components/listings.test.jsx) | 7 | Sign-in guard, required-field errors, photo preview/publish, repeat-submit protection, failed upload/retry, edits with an existing photo, owner-only editing |
| [offers.test.jsx](../../apps/passdown/tests/components/offers.test.jsx) | 7 | Sign-in return path, asking/lower/free offers, excessive-price validation, existing offers, reserved items, failure/retry |
| [deals.test.jsx](../../apps/passdown/tests/components/deals.test.jsx) | 11 | Buying/selling tabs, seller accept/decline/complete, unavailable-item blocker, buyer withdrawal confirmation, pickup validation/proposal/confirmation, messaging/retry, unavailable deals |

Tests use Vitest + jsdom, React Testing Library, and user-event. The real screens, form validation, child components, AuthContext, and MemoryRouter are rendered. Firebase read hooks/watchers and write services are mocked; Google sign-in/profile actions are provided through AuthContext. File uploads use local test Files and mocked object URLs. No external accounts, database writes, image uploads, or payment actions occur. These are component integration tests, not full browser/end-to-end tests or replacements for the Firestore rule suite.

## Introduction sites

Build and lint `sites/here`, then check its walkthrough, FAQs, app links, and desktop/phone layouts. For `sites/passdown`, run `node --check script.js` and preview its static files; check both buyer/seller modes, FAQs, links, and narrow layouts. Neither introduction submits real check-ins, listings, or offers.

Assemble the GitHub Pages artifact with `python3 scripts/assemble-pages.py --output /tmp/cs392-pages` after building Here!’s introduction. Verify the project index, `Here_Ad/`, `Passdown_Ad/`, and legacy `QRise_Ad/` redirect are present.

## Historical specification

[BorrowBuddy’s lending test specification](borrowbuddy-legacy.md) preserves the earlier Given/When/Then document. Its paths, loan behavior, and counts are historical and must not be used as the current Passdown test contract.

## Known existing Here! browser failures

The five-case browser suite currently reports three passes and two failures, reproduced against both the reorganized source and the unchanged pre-cleanup checkout:

- **Guest class settings:** `getByLabel("Discussion prompt")` matches both the textarea and the requirement checkbox; the test needs an exact locator.
- **End guest session:** deleting guest data is rejected by the Realtime Database rules, so the app remains in the guest workspace with a permission error.

These issues predate the folder/name cleanup. The unit tests, production builds, and Passdown security-rule tests pass. Review guest cleanup before relying on it; an attempted end-session action can fail instead of deleting data.
