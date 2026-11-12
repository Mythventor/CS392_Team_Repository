Here! - Quick and Easy Attendance

Here! is a free web app designed around a simple idea - simplifying attendance. Here! has a number of features to help streamline the process and make checking in easy and intuitive for both teachers and students alike, such as:

- QR code integration: Teachers can generate a new QR code for each day of attendance, or just have one code that refreshes each day. Students scan the displayed QR code and fill out a quick form to let their instructor know they're present and ready for class! In addition, checking in also provides the students with an instructor-set heads-up prompt, which could be a summary of today's lecture material, reminders about important deadlines, or a discussion prompt to get students ready for class!
- CSV Exports: Teachers can generate a CSV of each day's attendance to compare against their class list, helping to quickly identify who is and isn't there!
- Teacher accounts use a unique username and password. Guest access is not currently available.

The app does require some cookies to be used in order to store data without an account.

## Current prototype

Teachers can create an account with a unique username and password, sign in, and sign out. Usernames are 3–24 ASCII letters, numbers, underscores, or hyphens; uniqueness is case-insensitive. Passwords must be at least 8 characters. Guests can enter using Firebase Anonymous Authentication, create classes, generate QR check-in links, customize class details, and export a class's check-ins. Students submit check-ins through the QR link.

The Firebase database starts with no sample classes or student records. Existing browser-local data from the earlier prototype is not automatically migrated into Firebase.

## Firebase authentication

In Firebase Console, enable both **Authentication → Sign-in method → Email/Password** and **Anonymous**. Copy `.env.example` to `.env.local` and fill in the Firebase Web App config values; `.env.local` is ignored by Git. Vite embeds these values at build time, so rebuild and redeploy after changing them.

Firebase email/password authentication requires an email-shaped identifier, but the app intentionally asks only for a username. It maps the normalized username to an internal, non-deliverable address in the reserved `.invalid` domain. Firebase Authentication enforces uniqueness of that identifier, making usernames unique without a client-writable username registry. Usernames are case-insensitive.

Because accounts have no real email address, email verification, password reset, and account recovery are not available. Losing a password currently means losing access to that account; do not use this prototype for important data. A later version should choose a recoverable identity method before using accounts for production.

Guest classes and check-ins are scoped by the anonymous Firebase UID. The anonymous identity persists in that browser; ending the guest session, clearing site data, or switching browsers may make guest-owned classes inaccessible. Guest data is not linked to teacher accounts. Review and deploy `database.rules.json` before use (`firebase deploy --project here--attendance --only database`). Do not make database writes public as a workaround for authentication configuration problems. To test authentication locally, configure the Firebase Auth Emulator using `VITE_FIREBASE_AUTH_EMULATOR_HOST`.

The browser UI remains unavailable when Firebase configuration is missing. For `auth/api-key-not-valid`, verify the deployed Web API key/project configuration before expecting account creation or sign-in to work.