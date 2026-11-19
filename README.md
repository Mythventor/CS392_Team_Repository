# CS 392 · Yellow Team

Two student prototypes for Fall 2026: **Here!**, a QR attendance tool, and **Passdown**, a campus resale marketplace.

Contributors: Mengpang Xing, Angela Wan, Alison Bosch, and Yuqi Liao.

## Projects

| Project | Application | Introduction | Source |
| --- | --- | --- | --- |
| **Here!** | [Open attendance app](https://here--attendance.web.app) | [How Here! works](https://mythventor.github.io/CS392_Team_Repository/Here_Ad/) | [App](apps/here/) · [Website](sites/here/) |
| **Passdown** | [Open marketplace](https://passdown-cs392.web.app) | [How Passdown works](https://mythventor.github.io/CS392_Team_Repository/Passdown_Ad/) | [App](apps/passdown/) · [Website](sites/passdown/) |

## Repository layout

```text
apps/
  here/          Here! attendance app · React/Vite + Firebase
  passdown/      Passdown resale app · React/Vite + Firebase + Cloudinary
sites/
  here/          Here! introduction · React/Vite
  passdown/      Passdown introduction · static HTML/CSS/JS
  index.html     GitHub Pages project directory
scripts/
  assemble-pages.py  Collect both introductions for GitHub Pages
docs/            Development, deployment, and test documentation
.github/workflows/  CI and publishing
```

Each app has its own dependencies, lockfile, and Firebase configuration. Run commands from the relevant folder; there is no root npm project.

## Get started

Use Node.js 24.12+ (the repository’s `.nvmrc` selects Node 24). For either React app:

```sh
cd apps/here  # or apps/passdown
npm ci
cp .env.example .env.local
# Fill in the Firebase configuration in .env.local.
npm run dev
```

For Passdown’s local demo, use `npm run dev:emulator` instead; see its README for photo configuration. Firebase emulator tests require the Firebase CLI and JDK 21+.

- [Here! setup and features](apps/here/README.md)
- [Passdown setup and features](apps/passdown/README.md)
- [Here! introduction setup](sites/here/README.md)
- [Passdown introduction setup](sites/passdown/README.md)
- [Development and deployment](docs/README.md)
- [Current test coverage](docs/testing/README.md)

## Project history

Here! evolved from QRise; the current product handles attendance rather than morning alarms. Passdown evolved from BorrowBuddy’s lending prototype into resale. Historical Firebase identifiers may retain earlier names to preserve existing data and CI access. The old `QRise_Ad/` introduction URL redirects to `Here_Ad/`. BorrowBuddy hosting has been disabled.
