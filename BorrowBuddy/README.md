# BorrowBuddy

Students borrow things from other students on their campus. Built with React, Vite, and Firebase (Google sign-in and Cloud Firestore).

## Try it locally

You need Node.js 22.12+, Java, and the [Firebase CLI](https://firebase.google.com/docs/cli). This runs the app against local emulators with sample items, so it doesn't need a Firebase project:

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

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the app against the project in `.env.local` |
| `npm run dev:emulator` | Runs the app against local emulators with sample items |
| `npm test` | Runs unit tests for search, filters, and profiles |
| `npm run test:rules` | Tests `firestore.rules` on the Firestore emulator |
| `npm run lint` | Checks the code with ESLint |
| `npm run build` | Builds the production site into `dist/` |

## What's built so far

- Google sign-in, which is both sign-up and log-in, plus profile editing (`src/auth`, `src/pages/ProfilePage.jsx`)
- Homepage and navigation, with a bottom tab bar on phones (`src/pages/HomePage.jsx`, `src/components/Layout.jsx`)
- Browsing with search and category and campus filters, stored in the URL (`src/pages/BrowsePage.jsx`, `src/items`)

`/list` and `/items/:id` are placeholder routes in `src/App.jsx`, ready to be replaced by the real listing pages.

Campuses and categories live in one place: `src/items/model.js`. The campus names there are placeholders to replace with your school's.

## Data model

### `users/{uid}`

| Field | Type | Notes |
| --- | --- | --- |
| `displayName` | string | Up to 60 characters |
| `photoURL` | string or null | From Google |
| `campus` | string | A campus id from `src/items/model.js`; empty until setup is finished |
| `bio` | string | Up to 280 characters |
| `createdAt`, `updatedAt` | timestamp | |

### `items/{itemId}`

Homepage and browse read these fields, so new listings should save them:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | Yes | Up to 80 characters |
| `category` | string | Yes | A category id from `src/items/model.js` |
| `campus` | string | Yes | A campus id from `src/items/model.js` |
| `status` | string | Yes | `available` or `unavailable`; only `available` items are shown |
| `ownerId` | string | Yes | The owner's uid; security rules check it |
| `createdAt` | timestamp | Yes | Use `serverTimestamp()`; sets the newest-first order |
| `description` | string | No | Included in search |
| `photoURL` | string | No | Cards show a category icon when it's missing |
| `ownerName` | string | No | Shown as "Lent by". It's a copy, so it won't change if the owner renames themselves |
| `availableTo` | string | No | `YYYY-MM-DD`; the item is hidden after this date |

`firestore.rules` already lets owners create, edit, and delete their own items. New collections, such as borrow requests, need their own rules because everything else is closed by default.
