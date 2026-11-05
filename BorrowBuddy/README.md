# BorrowBuddy

Students borrow things from other students on their campus. Built with React, Vite, Firebase Spark (Google sign-in, Cloud Firestore and Hosting), and Cloudinary Free for listing photos. Firebase Cloud Storage is not used.

## Try it locally

You need Node.js 22.12+, Java, and the [Firebase CLI](https://firebase.google.com/docs/cli). This runs accounts and listing data against local emulators with sample items, so it doesn't need a Firebase project. Photo uploads still use Cloudinary; configure the two public Cloudinary variables in `.env.local` to test them:

```sh
npm ci
npm run dev:emulator
```

Open http://localhost:5173. Sign-in shows the emulator's test account screen instead of Google, where you can add a fake account.

## Use the team's Firebase project

The project is `borrowbuddy-cs392`. Ask its owner to add you under **Project settings > Users and permissions** in the [Firebase console](https://console.firebase.google.com/project/borrowbuddy-cs392/overview), then:

1. Print the web app's config:
   ```sh
   firebase apps:sdkconfig web --project borrowbuddy-cs392
   ```
2. Copy `.env.example` to `.env.local` and fill in those values.
3. Run `npm run dev`.

After changing `firestore.rules`, deploy them with `firebase deploy --only firestore:rules`.

To host the site, run `npm run build`, then `firebase deploy --only hosting`. If you use another domain, add it under **Authentication > Settings > Authorized domains**.

## Photos on Cloudinary Free

Set `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET` in `.env.local` before building. Both are public configuration; never expose the API secret in browser code or commit it.

Create a dedicated unsigned image upload preset with JPG/PNG/WebP allowed formats, generated unique IDs, public ID overrides disabled, and a BorrowBuddy asset folder. Unsigned uploads cannot overwrite existing photos. Enable short-lived deletion tokens for failed-save cleanup. The app rejects files over 5 MB; this client-side limit is not a server-side access control. Cloudinary presets do not support a per-preset file-size limit.

The public preset allows uploads from anyone who knows its name, independently of Firebase sign-in. For a small project, monitor the Free quota and disable the preset if abused; authenticated signed uploads would require a separate backend. Listing edits remain protected by Firestore owner rules. Photo URLs and public IDs are saved in the listing; deletion tokens are never persisted. Replaced/archived photos are retained in the Media Library for account-owner cleanup, preserving existing links without exposing an admin secret.

Deploy only Firestore rules and Hosting: `firebase deploy --only firestore:rules,hosting`. Build first with `npm run build`. No Firebase billing upgrade or Storage initialization is required.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the app against the project in `.env.local` |
| `npm run dev:emulator` | Runs the app against local emulators with sample items |
| `npm test` | Runs unit tests for search, filters, profiles, listings, and borrowing |
| `npm run test:rules` | Tests `firestore.rules` on the Firestore emulator |
| `npm run lint` | Checks the code with ESLint |
| `npm run build` | Builds the production site into `dist/` |

## What's built so far

- Google sign-in, which is both sign-up and log-in, plus profile editing (`src/auth`, `src/pages/ProfilePage.jsx`)
- Homepage and navigation, with a bottom tab bar on phones (`src/pages/HomePage.jsx`, `src/components/Layout.jsx`)
- Browsing with search and category and school filters, stored in the URL (`src/pages/BrowsePage.jsx`, `src/items`)

Listing creation, details, editing and archiving are implemented at `/list`, `/items/:id`, `/items/:id/edit`, and `/my-listings`.

Borrowing and loan management (`src/borrowing`, `src/pages/LoanPages.jsx`):

- **Request an item**: the item page has a "Request to borrow" form. Borrowers pick a first day and a return day (up to 14 days, inside the listing's dates) and can add a note. Days already booked are listed and can't be chosen.
- **Accept or decline**: owners answer requests from `/loans/:id`. Accepting books the days; other pending requests that overlap them are declined automatically with a reason. Owners can add a reason when declining.
- **Loans page** (`/loans`): a Borrowing tab and a Lending tab, grouped into Needs your attention, Out right now, Coming up, and History. The nav shows a badge with the number of requests waiting for you.
- **Pickup coordination**: either person suggests a place and time and the other confirms it; there's also a message thread for each loan.
- **Tracking**: either person marks the pickup, only the owner confirms the return, and either person can cancel before pickup. Every step is time-stamped in a timeline, and late returns are flagged as overdue.
- **No double bookings**: accepting writes one lock document per day in the same transaction. Security rules only allow creating a lock that doesn't exist yet, so two loans can never hold the same day, even if two people accept at the same moment. Cancelling or returning releases the days.

Schools and categories live in one place: `src/items/model.js`. New profiles start at Northwestern University (`DEFAULT_SCHOOL`).

## Data model

### `users/{uid}`

| Field | Type | Notes |
| --- | --- | --- |
| `displayName` | string | Up to 60 characters |
| `photoURL` | string or null | From Google |
| `school` | string | A school id from `src/items/model.js`; starts as `northwestern` |
| `bio` | string | Up to 280 characters |
| `createdAt`, `updatedAt` | timestamp | |

### `items/{itemId}`

Homepage and browse read these fields, so new listings should save them:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | Yes | Up to 80 characters |
| `category` | string | Yes | A category id from `src/items/model.js` |
| `school` | string | Yes | A school id from `src/items/model.js` |
| `status` | string | Yes | `available` or `unavailable`; only `available` items are shown |
| `ownerId` | string | Yes | The owner's uid; security rules check it |
| `createdAt` | timestamp | Yes | Use `serverTimestamp()`; sets the newest-first order |
| `description` | string | No | Included in search |
| `photoURL` | string | No | Cards show a category icon when it's missing |
| `ownerName` | string | No | Shown as "Lent by". It's a copy, so it won't change if the owner renames themselves |
| `availableTo` | string | No | `YYYY-MM-DD`; the item is hidden after this date |

`firestore.rules` already lets owners create, edit, and delete their own items. New collections need their own rules because everything else is closed by default.

### `requests/{requestId}`

One loan, from request to return. Only the owner and the borrower can read it, and it is never deleted.

| Field | Type | Notes |
| --- | --- | --- |
| `itemId`, `itemTitle`, `itemPhotoURL` | string | Copied from the item when requested |
| `ownerId`, `ownerName` | string | Must match the item's owner |
| `borrowerId`, `borrowerName` | string | The signed-in borrower; can't be the owner |
| `startDate`, `endDate` | string | `YYYY-MM-DD`, at most 14 days, inside the item's available dates |
| `message` | string | Optional note, up to 500 characters |
| `status` | string | `pending` → `accepted` / `declined` / `cancelled`; `accepted` → `picked_up` / `cancelled`; `picked_up` → `returned` |
| `createdAt`, `updatedAt`, `acceptedAt`, `declinedAt`, `cancelledAt`, `pickedUpAt`, `returnedAt` | timestamp | Server time for each step |
| `cancelledBy`, `pickedUpBy` | string | Who did it |
| `declineReason` | string | Optional, shown to the borrower |
| `pickup` | map | `{ place, time, note, proposedBy, confirmedBy }`; `time` is `YYYY-MM-DDTHH:mm` |

The rules check who can make each status change, and that a change touches only its own fields. For example, a borrower can't move the dates while marking the pickup.

### `requests/{requestId}/messages/{messageId}`

`senderId`, `senderName`, `text` (1–1000 characters), `createdAt`. Only the two people in the loan can read or send messages, and only as themselves.

### `items/{itemId}/bookedDays/{YYYY-MM-DD}`

`{ requestId }`. One document for each day an accepted loan holds. Anyone can read them so the item page can show booked days. They can only be created by the item's owner for an accepted request covering that day, and they're deleted when that loan is cancelled or returned.

Borrowing rules are tested in `tests/rules/borrowing.rules.test.mjs` (`npm run test:rules`).
