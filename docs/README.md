# Development and deployment

[Repository overview](../README.md) · [Test coverage](testing/README.md) · [Here! backlog](here-backlog.md)

## Work on one project at a time

Use Node.js 24.12+ (`nvm install` / `nvm use` from the repository root). Run npm commands inside `apps/here`, `apps/passdown`, or `sites/here`. Each has its own `package.json` and committed lockfile. `sites/passdown` is static and needs only a local HTTP server. Dependencies, build output, logs, and local environment files are ignored.

Copy the project’s `.env.example` to `.env.local` for local configuration. Never place private service-account keys or API secrets in `VITE_*` variables: those variables become public browser code. Existing tracked production configuration contains browser configuration, not server credentials.

## Applications on Firebase

| Application | Working directory | Firebase project | Hosting site |
| --- | --- | --- | --- |
| Here! | `apps/here` | `here--attendance` | `here--attendance` |
| Passdown | `apps/passdown` | `borrowbuddy-cs392` | `passdown-cs392` |

Build before deploying. From Here!’s directory:

```sh
npm ci
npm run build
firebase deploy --only database,hosting --project here--attendance
```

From Passdown’s directory:

```sh
npm ci
npm run build
firebase deploy --only firestore:rules,hosting --project borrowbuddy-cs392
```

Review the relevant app README for Firebase authentication and environment setup. Project IDs, account identifiers, and CI secrets are infrastructure references; do not blindly replace them during branding changes. Here! access requires permission to its Firebase project.

The [Passdown workflow](../.github/workflows/passdown.yml) runs lint, unit and React component tests, Firestore emulator tests, and a production build. Pushes affecting its source on `main` deploy rules and hosting when the `FIREBASE_SERVICE_ACCOUNT_BORROWBUDDY` secret is available. This legacy secret name is intentional. Here! currently uses manual Firebase deployment; this repository does not configure an automatic Here! production deploy.

## Introductions on GitHub Pages

The [Pages workflow](../.github/workflows/pages.yml) publishes a single artifact containing both introductions. Publishing only one directory would remove the other from the live site.

| Public path | Source |
| --- | --- |
| `/` | `sites/index.html` project directory |
| `/Here_Ad/` | `sites/here/dist/` after the Vite build |
| `/Passdown_Ad/` | Public files in `sites/passdown/` |
| `/QRise_Ad/` | Redirect to `../Here_Ad/` |

To assemble the artifact locally from the repository root:

```sh
npm --prefix sites/here ci
npm --prefix sites/here run build
python3 scripts/assemble-pages.py --output /tmp/cs392-pages
python3 -m http.server 5174 --directory /tmp/cs392-pages
```

The Here! build embeds the repository base path, so use Vite’s preview command in `sites/here` for a complete local preview. The assembled artifact is intended to be served beneath `/CS392_Team_Repository/` on GitHub Pages.

## Naming and history

- **Here!** is the product name; use `here` in package and directory names. It replaced QRise’s alarm concept with attendance.
- **Passdown** is the resale product; use `passdown` in package and directory names. BorrowBuddy’s lending specification is preserved only in [the historical document](testing/borrowbuddy-legacy.md).
- Source folders use lowercase names grouped by purpose. Public ad URLs retain their established capitalization independently of source paths.
