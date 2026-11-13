# Here! - Quick and Easy Attendance

Here! helps teachers manage class attendance with QR check-in links, live attendance lists, and CSV exports.

## Current prototype

Teachers can create an account with a display name, unique username, and password, then sign in and out. Usernames are 3–24 ASCII letters, numbers, underscores, or hyphens; uniqueness is case-insensitive. Passwords must be at least 8 characters. Teacher classes and attendance are saved under the signed-in Firebase UID. Guests can create one class and use its class settings, QR code, and export. Creating an account from a guest session links the guest identity, preserving its class and attendance.

Teachers can create multiple classes, customize meeting times and discussion prompts, generate check-in QR links, view attendance, and export data. Students submit their name and student ID through a class QR link, with a prompt response when enabled. Check-ins are marked late if they occur after the meeting time and the configured grace period (five minutes by default).

The Firebase database starts with no sample classes or student records. Existing browser-local data from the earlier prototype is not automatically migrated.

## Firebase authentication and class storage

Enable **Authentication → Sign-in method → Email/Password** and **Anonymous** in Firebase Console. Copy `.env.example` to `.env.local` and fill in the Firebase Web App config values; `.env.local` is ignored by Git. Vite embeds these values at build time, so rebuild and redeploy after changing them.

The app maps normalized usernames to internal, non-deliverable addresses in the reserved `.invalid` domain. Firebase Authentication enforces case-insensitive uniqueness without a client-writable username registry. Since accounts have no real email address, email verification and account recovery are not available. Users can change their password while signed in by re-entering the current password. Do not use this prototype for important data.

Teacher classes and check-ins are scoped by the signed-in Firebase UID. Guest classes and check-ins are scoped by the anonymous Firebase UID. Creating an account from the guest session keeps the same UID and data; ending the session permanently deletes its class and attendance data. Clearing browser data before converting the account may make guest data inaccessible. Review and deploy `database.rules.json` before use (`firebase deploy --only database`). Do not make database writes public to work around authentication configuration problems.

The browser UI remains unavailable when Firebase configuration is missing. For local authentication testing, configure the Firebase Auth Emulator using `VITE_FIREBASE_AUTH_EMULATOR_HOST`.

## Class attendance

- Class settings include a meeting time, an optional discussion prompt, a toggle to require a response, and an adjustable 0–60 minute grace period. Set the grace period to zero to disable it.
- The default grace period is five minutes. Check-ins at or before the meeting time plus grace period count as on time.
- Meeting time and arrival status use the class's local timezone, recorded when the class is created.
- Students use the class QR link to submit their name and student ID. If the class requires a discussion response, the prompt and required text field are shown before submission.
- Teachers can open the attendance list to review names, IDs, local check-in times, on-time/late status, and prompt responses; exports include the same attendance details.
- Class QR links use the Realtime Database. The old separate event check-in feature has been retired.

### Firebase setup

In the Firebase console for project `cs392-react-challenge-692dd`:

1. Enable Anonymous Authentication.
2. Ensure a Firebase Web app exists.

From `QRise/`, deploy the database rules and app:

```sh
npm install
firebase deploy --only database
npm run build
firebase deploy --only hosting
```

For local development, create `QRise/.env.local` with the Web App settings:

```sh
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=cs392-react-challenge-692dd.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=cs392-react-challenge-692dd
VITE_FIREBASE_APP_ID=...
```

### Limitations

- Student names and IDs are typed, not verified.
- Older classes without a saved timezone use the current device timezone until their settings are saved.
- Class check-in QR codes stay active until the teacher refreshes the code.

## Tests

Run unit tests, lint, and a production build:

```sh
npm test
npm run lint
npm run build
```

The Playwright suite (`npm run test:e2e`) covers teacher account entry, guest class limits/settings, account conversion, and ending a guest session. It uses demo Auth and Realtime Database emulators. Install the Firebase CLI, a JDK 21 or newer, and Chromium with `npm install -g firebase-tools` and `npx playwright install chromium`. Unit tests include class attendance timing and username validation.

## Deployment

QRise is hosted at [https://qrise-cs392.web.app](https://qrise-cs392.web.app) as its own Firebase Hosting site in project `cs392-react-challenge-692dd`. The `.firebaserc` file selects the project, and `firebase.json` configures Hosting and Realtime Database rules.
