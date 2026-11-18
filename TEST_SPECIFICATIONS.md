# Passdown Test Specifications

This document lists every automated test in the `Passdown/` app, written in Given / When / Then form.

**About the test suite**

- Passdown has **no React component tests**: there are no `@testing-library/react` renders, `fireEvent` or `userEvent` calls. The tests check the plain JavaScript logic behind the React screens (search and filters, form validation, borrowing rules, photo uploads) and the Firestore security rules that guard the database.
- All tests use Node's built-in test runner (`node:test`). None of them use `describe` blocks, so every test sits at the top level of its file. The "Test Suite / Describe" column therefore shows the file's top level.
- **Unit tests** (`Passdown/tests/*.test.mjs`) run with `npm test`.
- **Security rule tests** (`Passdown/tests/rules/*.test.mjs`) run with `npm run test:rules`, which starts a local Firestore emulator. Before each rules test the database is wiped. "Sam" is the item owner, "Alex" the borrower and "Jo" an unrelated student.

| File | Tests |
|---|---|
| `Passdown/tests/model.test.mjs` | 13 |
| `Passdown/tests/listings.test.mjs` | 5 |
| `Passdown/tests/borrowing.test.mjs` | 8 |
| `Passdown/tests/photoUpload.test.mjs` | 4 |
| `Passdown/tests/rules/firestore.rules.test.mjs` | 10 |
| `Passdown/tests/rules/borrowing.rules.test.mjs` | 16 |
| **Total** | **56** |

---

## Item browsing and profile helpers — `Passdown/tests/model.test.mjs`

Tests `src/items/model.js` (`filterItems`, `filtersFromParams`, `hasActiveFilters`, `browseUrl`, `isAvailable`, `newestFirst`) and `src/auth/profileModel.js` (`validateProfile`, `initials`, `safeNextPath`). Shared sample data: three items — a "Cordless Drill" (tools, Northwestern, description "Comes with bits"), a "Lamp for your desk" (dorm, DePaul) and a "Calculus textbook" (books, Northwestern), each with a different creation time.

| Test Suite / Describe | Test Name | Given (Initial State) | When (Action / Event) | Then (Expected Outcome) |
|---|---|---|---|---|
| (top level) | search ignores case and matches title or description | The three sample items | `filterItems` is called with search text "DRILL", then with "bits" | Both searches return only the drill: "DRILL" matches its title despite the capitals, "bits" matches its description |
| (top level) | every search word must match, in any order | The three sample items | `filterItems` is called with "desk lamp", then with "desk drill" | "desk lamp" returns only the lamp (words found in reverse order); "desk drill" returns nothing because no single item contains both words |
| (top level) | search also finds category and school names | The three sample items | `filterItems` is called with "tools", then with "depaul university" | "tools" returns the drill (its category); "depaul university" returns the lamp (its school's full name) |
| (top level) | search, category, and school filters combine | The three sample items | `filterItems` is called with school = Northwestern; then Northwestern + category books; then DePaul + search "drill" | Northwestern returns the drill and the book; adding "books" narrows it to the book; DePaul + "drill" returns nothing |
| (top level) | blank searches keep every item | The three sample items | `filterItems` is called with a search of only spaces, then with no filters at all | All three items are returned both times |
| (top level) | items with no optional fields can still be searched | A single item that has only an id and status (no title, description, category or school) | `filterItems` searches it for "x" | No error is thrown and the result is empty |
| (top level) | URL filters drop unknown values | A browse URL query `q=tent&category=nope&school=northwestern`, and a second query whose search is only spaces | `filtersFromParams` reads each query and `hasActiveFilters` checks the result | The unknown category "nope" becomes blank while search "tent" and school Northwestern are kept; filters count as active. The spaces-only search counts as not active |
| (top level) | browse links encode search text and skip empty filters | No filters, a blank search, and a search "a&b" with category tools | `browseUrl` builds a link for each | No filters and blank search both give `/browse`; the third gives `/browse?q=a%26b&category=tools` (the "&" is safely encoded) |
| (top level) | only current, available items count as available | Items with status available, unavailable, available until today, and available until yesterday; today is 2026-05-10 | `isAvailable` checks each item | Available → yes; unavailable → no; available until today → yes; availability ended yesterday → no |
| (top level) | newest items come first without changing the original list | The three sample items in their original order | `newestFirst` sorts them | Result order is lamp, book, drill (newest first), and the original list still starts with the drill (it was not changed) |
| (top level) | profile validation reports each problem | A valid profile (name "Sam", Northwestern, empty bio); an invalid one (blank name, unknown school "mars", 281-character bio); and one with a 61-character name | `validateProfile` checks each profile | The valid profile has no errors; the invalid one has errors for exactly `bio`, `displayName` and `school`; the 61-character name produces a `displayName` error |
| (top level) | initials use the first and last names | Names "sam rivera", "Sam Q Rivera", "Sam" and an empty name | `initials` is called for each | Returns "SR", "SR" (middle name ignored), "S", and "?" for an empty name |
| (top level) | sign-in only returns to paths on this site | A safe in-site path `/browse?q=tent`, plus unsafe values: a full external URL, `//evil.example`, `/\evil.example`, `evil`, empty text and `null` | `safeNextPath` checks where to send the user after sign-in | The safe path is kept as-is; every unsafe value is replaced with the home page `/` |

---

## Listing form validation — `Passdown/tests/listings.test.mjs`

Tests `src/items/listingModel.js` (`validateListing`, `photoError`) and `isAvailable` from `src/items/model.js`. Shared sample data: a valid "Calculator" listing (electronics, Northwestern, condition Good, pickup at the University library, available 2099-01-01 to 2099-01-07).

| Test Suite / Describe | Test Name | Given (Initial State) | When (Action / Event) | Then (Expected Outcome) |
|---|---|---|---|---|
| (top level) | new listing accepts valid data and requires a photo | The valid Calculator listing | `validateListing` runs once with a photo attached and once without | With a photo there are no errors; without a photo a `photo` error is reported |
| (top level) | rejects reversed dates, impossible dates, unknown categories and blank details | The Calculator listing changed to start on 2099-02-30 (a date that does not exist), end before it starts, use category "fake" and have a blank pickup area; a photo is attached | `validateListing` checks it | Errors are reported for `availableFrom`, `availableTo`, `category` and `pickupArea` |
| (top level) | existing listings can retain a past start but new listings cannot | The Calculator listing with a start date in the year 2000, with a photo | `validateListing` runs as a new listing, then in editing mode (`editing: true`) | As a new listing an `availableFrom` error is reported; when editing an existing listing there is no `availableFrom` error |
| (top level) | photos reject unsupported files and files over 5 MB | An SVG image, a 6 MB PNG, and a 1 KB JPEG | `photoError` checks each file | The SVG and the 6 MB PNG each get an error message; the small JPEG gets an empty message (accepted) |
| (top level) | archived listings never appear as available | An item marked available but also archived | `isAvailable` checks it | It is reported as not available |

---

## Borrowing rules and loan dashboard — `Passdown/tests/borrowing.test.mjs`

Tests `src/borrowing/model.js`. Shared setup: "today" is 2026-11-05; a drill listed as available from 2026-11-01 to 2026-12-31; a sample pending request from Alex (borrower) to Sam (owner) for 2026-11-10 to 2026-11-12. The maximum loan is `MAX_LOAN_DAYS` (14 days).

| Test Suite / Describe | Test Name | Given (Initial State) | When (Action / Event) | Then (Expected Outcome) |
|---|---|---|---|---|
| (top level) | date helpers handle month ends, leap days and invalid dates | Various calendar dates, including month ends, a leap year, a non-existent date and a US-style date | `addDays`, `daysBetween` and `isDay` are called | Adding a day to Nov 30 gives Dec 1; to Feb 28, 2028 gives Feb 29; Dec 30 to Jan 2 lists all four days across the new year; "2026-02-30" and "11/05/2026" are not valid days; "2026-11-05" is |
| (top level) | ranges that share even one day overlap; back-to-back ranges do not | Two pairs of date ranges: Nov 10–12 with Nov 12–14, and Nov 10–12 with Nov 13–14 | `rangesOverlap` compares each pair | Sharing Nov 12 counts as overlapping; back-to-back ranges (12th then 13th) do not overlap |
| (top level) | a request must be in the future, inside the listing's dates, at most 14 days, and not on booked days | The drill listing, today = Nov 5, and a valid request for Nov 10–12 | `validateRequest` checks the valid request and several variations | Valid request → no errors. Errors when: the start is in the past (Nov 4); the end is before the start; the end runs past the listing's last day; the loan is 15 days. A 14-day loan is accepted. Nov 11 already booked → end-date error mentioning "already booked". A 501-character message → `message` error. Empty dates → `startDate` error |
| (top level) | only the right person can move a request to the next step | The sample request in different statuses; users Sam (owner), Alex (borrower) and a stranger | `canDo` asks whether each person may accept, decline, cancel, mark pickup or mark returned; `nextStatus("pickup")` is called | Only Sam can accept or decline a pending request; Alex can cancel while pending; Sam can cancel once accepted; nobody can cancel once picked up; Alex can mark pickup on an accepted loan but Sam cannot mark pickup on a pending one; only Sam can mark it returned; a stranger can do nothing. The status after "pickup" is `picked_up` |
| (top level) | accepting a request finds overlapping pending requests to decline and detects booked days | The sample request being accepted, plus other requests: one pending overlapping on Nov 12, one pending starting Nov 13, one cancelled overlapping, and one for a different item (tent); and booked-day records | `conflictingRequests` lists requests that clash; `bookingConflict` checks booked days | Only the overlapping pending request (r2) is listed as a conflict. A day booked by another request is a conflict; a day booked by this same request is not; a booked day outside the loan (Nov 13) is not |
| (top level) | loans are grouped by what needs attention, and overdue loans are flagged | Seven loans seen by Sam: an incoming pending request, one Sam is borrowing, one accepted starting today, one accepted for later, one currently out, one out and past its end date, and one returned | `groupLoans`, `isOverdue` and `pendingIncomingCount` are called for Sam on Nov 5 | "Needs action": late, today, incoming (in that order). "Upcoming": Sam's own borrow and the later loan. "Out": the current loan. "Past": the returned loan. The late loan is overdue, and Sam has 1 pending incoming request |
| (top level) | the status summary is written from each person's point of view | The sample request in several states (pending, picked up past its end date, cancelled by Alex) | `loanSummary` produces the status text for Sam and for Alex | Sam sees "Alex wants to borrow…"; Alex sees "Waiting for Sam…"; an overdue loan says "Overdue"; Alex sees "You cancelled", while Sam sees "Alex cancelled" |
| (top level) | a pickup plan needs a place and a time | A complete plan (Main library entrance, Nov 10 at 3:30 pm), one with a blank place, and one with no time | `validatePickup` checks each | The complete plan has no errors; a blank place gives a `place` error; a missing time gives a `time` error |

---

## Photo upload to Cloudinary — `Passdown/tests/photoUpload.test.mjs`

Tests `src/items/photoUpload.js` (`uploadPhoto`, `discardUpload`). Shared setup: Cloudinary settings (cloud "test-cloud", upload preset "listings"), a small PNG file, and a sample Cloudinary reply. Network calls are replaced with fake functions so no real upload happens.

| Test Suite / Describe | Test Name | Given (Initial State) | When (Action / Event) | Then (Expected Outcome) |
|---|---|---|---|---|
| (top level) | uploads images using only the public preset and returns a verified delivery URL | Valid settings, the PNG file, and a fake network call that returns a successful Cloudinary reply | `uploadPhoto` uploads the file | The request goes to `https://api.cloudinary.com/v1_1/test-cloud/image/upload` and sends only the file and the "listings" preset (no secrets). The result's `photoURL` is the Cloudinary link and `photoPublicId` is "photo" |
| (top level) | missing config and invalid photos fail before contacting Cloudinary | A fake network call that fails the test if it is ever used | `uploadPhoto` is called with empty settings, then with an SVG file | Empty settings fail with a "not configured" error; the SVG fails with an error mentioning JPG. The network is never contacted |
| (top level) | handles network errors, non-JSON errors, and unexpected hosts | Valid settings and four fake network replies: the connection drops; a "rate limited" 429 text reply; a reply whose image link is on another website; a reply whose link is on Cloudinary but for a different account | `uploadPhoto` is called with each | Dropped connection → "interrupted" error; 429 reply → "failed" error; both wrong-link replies → "invalid" error |
| (top level) | failed-save cleanup uses only a short-lived delete token | A fake network call that counts how many times it is used | `discardUpload` is called once with no delete token and once with the token "temporary-token" | With no token nothing is sent. With the token, one request goes to `.../test-cloud/delete_by_token` carrying that token. The network was called exactly once in total |

---

## Profile and item security rules — `Passdown/tests/rules/firestore.rules.test.mjs`

Tests the Firestore security rules in `Passdown/firestore.rules` against the local emulator. Shared data: a valid profile for Sam (Northwestern, empty bio) and a valid drill item owned by Sam.

| Test Suite / Describe | Test Name | Given (Initial State) | When (Action / Event) | Then (Expected Outcome) |
|---|---|---|---|---|
| (top level) | people can create only their own profile | An empty database | Sam saves a profile at `users/sam`; Sam tries to save one at `users/alex`; a signed-out visitor tries `users/sam` | Sam's own profile is saved; the other two attempts are blocked |
| (top level) | profiles reject invalid fields | An empty database, signed in as Sam | Sam saves his profile with a 61-character name; with a 281-character bio; with an extra `isAdmin: true` field | All three saves are blocked |
| (top level) | only signed-in students can read profiles | Sam's profile exists | Alex (signed in) reads it; a signed-out visitor reads it | Alex can read it; the signed-out visitor is blocked |
| (top level) | only the owner can edit a profile, and never its creation time | Sam's profile exists | Sam updates his bio; Alex tries to change Sam's bio; Sam tries to change the profile's `createdAt` | Sam's bio update succeeds; Alex's edit and the creation-time change are blocked |
| (top level) | profiles can't be deleted from the app | Sam's profile exists | Sam tries to delete it | The delete is blocked |
| (top level) | anyone can browse items | The drill item exists | A signed-out visitor reads it | The read succeeds |
| (top level) | items must be created by a signed-in owner with valid fields | An empty database | Sam creates a valid item; a signed-out visitor creates one; Alex creates one claiming Sam as owner; Sam creates one with a blank title; Sam creates one with status "stolen" | Only Sam's valid item is saved; all other attempts are blocked |
| (top level) | only the owner can edit or delete an item, and can't hand it to someone else | The drill item owned by Sam exists | Alex tries to rename it; Sam tries to change the owner to Alex; Alex tries to delete it; Sam renames it; Sam deletes it | Alex's edit, the ownership change and Alex's delete are blocked; Sam's rename and delete succeed |
| (top level) | other collections stay closed by default | An empty database | Sam writes to and reads from an unrelated `secrets` collection | Both the write and the read are blocked |
| (top level) | listing dates, condition, photo ownership and archive status are validated | Signed in as Sam | Sam saves items with: an end date before the start date; condition "invalid"; a photo stored under Alex's folder; archived but still marked available; archived and marked unavailable | The first four are blocked; the archived + unavailable item is saved |

---

## Borrowing security rules — `Passdown/tests/rules/borrowing.rules.test.mjs`

Tests the Firestore security rules for borrow requests, booked-day locks (which prevent double bookings), pickup plans and messages. Before each test the database is wiped and Sam's available drill is added (listed from today to 60 days from now). A sample request is from Alex to Sam for 3 to 5 days from today. "Accepting" means changing the request to accepted and writing one booked-day lock per loan day, all in one atomic step, as the app does.

| Test Suite / Describe | Test Name | Given (Initial State) | When (Action / Event) | Then (Expected Outcome) |
|---|---|---|---|---|
| (top level) | a student can request someone else's item for valid dates | Sam's drill is listed | Alex creates a valid pending request for it | The request is saved |
| (top level) | requests are rejected for your own item, for someone else, or with forged fields | Sam's drill is listed | Sam requests his own item; Alex creates a request in Jo's name; Alex creates one already marked accepted; Alex names a wrong owner; Alex adds an extra `paid: true` field; a signed-out visitor creates a request | All six attempts are blocked |
| (top level) | request dates must be in order, at most 14 days, not in the past, and inside the listing's dates | Sam's drill is listed; signed in as Alex | Alex requests: end before start; a 15-day loan; a 14-day loan; dates in the past; dates running past the listing's end; a start date of "soon" | Only the 14-day loan is saved; all others are blocked |
| (top level) | archived or unavailable items can't be requested | Sam's drill is changed to unavailable and archived | Alex requests it | The request is blocked |
| (top level) | only the owner and borrower can read a request | A request from Alex to Sam exists | Alex reads it; Sam reads it; Jo reads it; Sam lists requests where he is the owner; Jo lists all requests | Alex, Sam and Sam's owner list succeed; Jo's read and Jo's list are blocked |
| (top level) | the owner accepts by locking every day; accepting without locks or as the borrower fails | A pending request from Alex exists | Sam marks it accepted without writing day locks; Alex tries the full accept; Sam does the full accept; the first loan day's lock is then read | The no-lock accept and Alex's accept are blocked; Sam's full accept succeeds and the lock for the first day points to this request |
| (top level) | two loans can never hold the same day | Two pending requests: r1 (days 3–5) and r2 from Jo (days 5–7) | Sam accepts r1, then tries to accept r2 | r1 is accepted; r2's acceptance is blocked entirely (even its free days), and r2 is still pending |
| (top level) | locks can't be written for other requests, other items, or days outside the loan | An accepted request r1 (days 3–5) exists | Sam writes a lock for day 10; Alex writes a lock for day 3; Sam writes a lock on a different item (tent) | All three lock writes are blocked |
| (top level) | the owner can decline; the borrower can withdraw a pending request | Two pending requests from Alex exist | Alex tries to decline r1; Sam declines r1 with a reason; Sam tries to cancel r2 as the canceller; Alex cancels r2 | Alex's decline and Sam's cancel are blocked; Sam's decline and Alex's withdrawal succeed |
| (top level) | cancelling an accepted loan frees its days for someone else | Sam has accepted Alex's request (days locked) | Alex cancels it and removes its day locks in one step; then Jo requests the same days and Sam accepts Jo's request | Alex's cancellation succeeds and Sam can accept Jo's request for the freed days |
| (top level) | locks for an active loan can't be deleted | Sam has accepted Alex's request (days locked) | Sam tries to delete a day lock; Jo tries to delete a day lock | Both deletes are blocked |
| (top level) | either person marks pickup; only the owner confirms the return | An accepted request exists | Alex marks it picked up; Alex tries to mark it returned; Sam marks it returned; Sam tries to set it back to accepted | Alex's pickup and Sam's return succeed; Alex's return and reopening the finished loan are blocked |
| (top level) | status changes can't sneak in other edits, and requests can't be deleted | An accepted request exists | Alex marks pickup while also extending the end date; Alex marks pickup claiming Sam did it; Sam tries to delete the request | All three are blocked |
| (top level) | pickup plans: either person proposes, only the other confirms | An accepted request exists, and a pickup plan (Main library, day 3 at 3 pm) | Alex proposes a plan in Sam's name; Alex proposes it as himself; Alex confirms his own plan; Sam confirms while changing the place; Sam confirms the plan unchanged; Jo proposes a plan | Only Alex's own proposal and Sam's unchanged confirmation succeed; all others are blocked |
| (top level) | only the two people in a loan can read and send its messages, as themselves | A request between Alex and Sam exists | Alex sends a message as himself; Sam reads the messages; Alex sends one pretending to be Sam; Jo sends one; Jo reads the messages; Alex sends an empty message | Alex's own message and Sam's read succeed; the impersonated message, Jo's send, Jo's read and the empty message are blocked |
| (top level) | anyone can see which days are booked | A booked-day lock exists for day 3 of the drill | A signed-out visitor reads it | The read succeeds |
