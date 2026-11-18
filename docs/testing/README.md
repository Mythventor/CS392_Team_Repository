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

From `apps/passdown/`: run `npm test`, `npm run lint`, and `npm run build`. Run `npm run test:rules` for Firestore security tests with the `demo-passdown` emulator project (Firebase CLI and JDK 21+ required).

| File | Cases | Coverage |
| --- | ---: | --- |
| [tests/deals.test.mjs](../../apps/passdown/tests/deals.test.mjs) | 9 | Offers, participant actions, reservations, completion, pickup validation, and dashboard groups. |
| [tests/listings.test.mjs](../../apps/passdown/tests/listings.test.mjs) | 5 | Whole-dollar prices, free listings, dates, categories, photos, and archived listings. |
| [tests/model.test.mjs](../../apps/passdown/tests/model.test.mjs) | 13 | Search, category/school filters, URLs, profile validation, availability, initials, and safe sign-in paths. |
| [tests/photoUpload.test.mjs](../../apps/passdown/tests/photoUpload.test.mjs) | 4 | Cloudinary requests, config and file checks, error handling, and failed-save cleanup. |
| [tests/rules/deals.rules.test.mjs](../../apps/passdown/tests/rules/deals.rules.test.mjs) | 14 | Offer validation, participant access, atomic item reservations, cancellations, sale completion, pickup confirmation, and messages. |
| [tests/rules/firestore.rules.test.mjs](../../apps/passdown/tests/rules/firestore.rules.test.mjs) | 10 | Profile ownership and validation, public browsing, listing ownership, and default-deny access. |

Passdown currently has **55 tests**: 31 unit cases and 24 Firestore rule cases. Negative security tests deliberately produce permission-denied emulator logs; success means the test runner exits with zero failures.

These suites test domain logic and Firebase rules. They do not render React components. In particular, the old lending/loan tests are no longer part of the resale app.

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
