# GroupSync

Group project organizer built with React, Vite, Firebase Authentication, Firestore, and Firebase Hosting.

**Live:** https://groupsync-cs392.web.app

## Features

- Multiple projects with descriptions, deadlines, and invited teammates.
- Software, research, and presentation templates create editable starter tasks and distribute assignments evenly. No AI is used.
- Task creation, editing, deletion, priorities, assignment, search, member filters, and three status columns.
- Project progress and individual workload summaries.
- Shared, append-only contribution timeline with author, time, and contribution notes. Notes are self-reported; this is not independent verification of work.
- In-app upcoming/overdue reminders and personal `.ics` calendar export with a 24-hour alarm. Calendar apps control alarm behavior. No background push or email reminders.
- Google sign-in and live Firestore updates for verified, invited members. Project owners manage invitations; invitations grant access without sending email.
- Browser-local demo available before sign-in. Demo projects are not automatically uploaded or shared. Clear browser site data to reset the demo.
- Responsive layout, accessible labels, keyboard focus trapping, and Escape-to-close dialogs.

## Run locally

Use Node 24 (the repository's `.nvmrc`).

```sh
cd apps/GroupSync
npm ci
npm run dev
```

Public Firebase web configuration is checked in at `src/firebase-config.json`. It is an app identifier, not a server credential. Firestore rules protect project data. For a different Firebase project, copy `.env.example` to `.env.local` and fill all four `VITE_FIREBASE_*` values.

### Required console step for live collaboration

The Firebase project, web app, free-tier Firestore database, Hosting deployment, and security rules have been created. **Firebase Authentication still needs initialization in the console.** Its REST initialization endpoint requires billing; no billing was enabled.

1. Open https://console.firebase.google.com/project/groupsync-cs392/authentication and click **Get started**.
2. Under **Sign-in method**, enable **Google**, choose a project support email, and save.
3. Under **Settings → Authorized domains**, ensure `groupsync-cs392.web.app` and `groupsync-cs392.firebaseapp.com` are present. Add `localhost` for local sign-in testing.
4. Open the deployed app, sign in, and create a project. Invite teammates using the exact email shown by their Google account.

Until that step is complete, the deployed app supports the full local demo but live sign-in is unavailable. A real-user, multi-browser sign-in test remains pending this setup.

## Verification

```sh
npm run lint
npm test
npm run test:rules
npm run build
```

The rules suite requires Java 21+ and Firebase CLI (`npm install -g firebase-tools@15.31.0`). It uses the isolated `demo-groupsync` emulator project, never production. Tests cover assignment distribution, progress, calendar escaping, reminders, verified member access, membership queries, owner-only invitations, atomic project creation, task validation, outsider denial, and immutable author-attributed events.

## Deployment

```sh
npm run build
firebase deploy --only firestore:rules,hosting --project groupsync-cs392
```

`.github/workflows/groupsync.yml` runs lint, unit tests, emulator rules tests, and the production build on relevant PRs and pushes. Main-branch changes deploy only after checks pass. Configure the `groupsync-production` GitHub environment for any desired reviewer protection.

### Pending CI authorization

The workflow is prepared for **keyless Workload Identity Federation**, avoiding service-account JSON keys. Provisioning was blocked by automatic approval review because it creates persistent deployment access. No CI IAM grants were applied.

Required resources after approval:

- Workload identity pool: `projects/649256389631/locations/global/workloadIdentityPools/groupsync-github`
- OIDC provider: `github`, issuer `https://token.actions.githubusercontent.com`
- Map `google.subject = assertion.sub`, `attribute.repository = assertion.repository`.
- Restrict the provider condition to this repository's numeric repository ID, numeric owner ID, and `assertion.ref == 'refs/heads/main'` to prevent name-reuse or PR-based access.
- Deployment service account: `groupsync-deploy@groupsync-cs392.iam.gserviceaccount.com`
- On that account, grant `roles/iam.workloadIdentityUser` to the principal set ending in `/attribute.repository/Mythventor/CS392_Team_Repository` for the above pool.
- Within **groupsync-cs392 only**, grant the service account `roles/firebasehosting.admin`, `roles/firebaserules.admin`, `roles/firebase.viewer`, and `roles/serviceusage.serviceUsageConsumer`.
- Enable `iam.googleapis.com`, `iamcredentials.googleapis.com`, and `sts.googleapis.com` as needed.

Until IAM is authorized and provisioned, checks can run after the files are pushed, but the deploy job will fail authentication. Source changes and the workflow are currently local; no commit or push has been made.

## Future AI integration

`.env.example` includes unused **server-only** `AI_API_KEY` and `AI_MODEL` placeholders. There is no AI implementation, request, or AI key in the frontend. Do not use `VITE_` for an AI secret: Vite exposes those values to browsers. A future team implementation should keep credentials in a server secret manager, expose an authenticated endpoint, validate generated tasks, and let members review assignments before saving. Replace or supplement `starterTasks()` in `src/model.js` through that future service.

## Data model and access

`projects/{id}` stores metadata, owner email, and member emails. Subcollections `tasks` and `events` hold task records and contributions. Verified members may manage tasks; only owners may update membership. Events cannot be modified or deleted by browser clients. Project deletion is denied. Unauthenticated and uninvited clients have no access. Client timestamps are for team coordination, not trusted audit or grading evidence.

No file uploads, paid services, AI, or notification backend are provisioned.
