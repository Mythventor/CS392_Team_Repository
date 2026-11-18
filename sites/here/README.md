# Here! introduction website

[Live introduction](https://mythventor.github.io/CS392_Team_Repository/Here_Ad/) · [Attendance app](https://here--attendance.web.app) · [App source](../../apps/here/) · [Repository overview](../../README.md)

A React/Vite introduction to Here!’s current attendance workflow: create a class, share its QR check-in link, review responses, and export attendance. The walkthrough is illustrative and does not create classes or collect student information. Here! was previously named QRise; the retired alarm product is no longer described here.

## Local development

Use Node.js 24.12+:

```sh
cd sites/here
npm ci
npm run dev
```

Vite uses the `/CS392_Team_Repository/Here_Ad/` base path, including during local development. To verify production output, run `npm run build` and `npm run preview`. Run `npm run lint` for code checks.

## Publishing

The shared [Pages workflow](../../.github/workflows/pages.yml) builds this project and assembles both introductions with [assemble-pages.py](../../scripts/assemble-pages.py). Changes under `sites/` or to the publishing script on `main` trigger deployment. `Here_Ad/` is the canonical introduction address; `QRise_Ad/` redirects there to preserve existing links. Application deployment remains separate in `apps/here/`.

## Content and checks

The page describes teacher accounts, one-class guest sessions, configurable student IDs and discussion prompts, attendance check-ins, and CSV exports. Data-handling text follows `apps/here/src/firebase.js`, `App.jsx`, `username.js`, and `database.rules.json`. The introduction itself has no forms, app SDKs, analytics, external fonts, or remote images. GitHub receives ordinary hosting requests.

Check all walkthrough buttons, FAQ expansion, app links, keyboard focus, and desktop/phone layouts after edits. Recheck privacy copy when the application’s authentication or data storage changes.
