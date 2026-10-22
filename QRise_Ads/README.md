# QRise introduction website

This standalone React/Vite website explains QRise, its setup, prototype limitations, and data handling. All app calls to action link to https://qrise-cs392.web.app.

Repository layout:

```text
QRise/       Alarm application
QRise_Ads/   Introduction website (this project)
```

## Run locally

Use Node.js 22.12+ or a supported newer version. From the repository root:

```sh
cd QRise_Ads
npm ci
npm run dev
```

Open the URL printed by Vite. To produce the static website:

```sh
npm run build
npm run preview
```

The output is `dist/`. It can be hosted as a separate static website. This project does not share the alarm application's Firebase hosting configuration; deploying its files over the app at `qrise-cs392.web.app` would replace the application that its buttons link to. No deployment is performed by these commands.

## Content and privacy

The page includes an interactive three-step illustration, setup instructions, prototype/support notice, privacy details, and expandable FAQs. The illustration does not create alarms or access the camera.

Privacy wording was checked against `../QRise/src/storage.js`, `../QRise/src/qr/scanner.js`, `../QRise/src/qr/model.js`, and the app's Firebase Hosting configuration on October 22, 2026. Recheck this wording whenever accounts, telemetry, cloud storage, logging configuration, or camera behavior changes. Hosting log availability and retention are provider/configuration dependent; the page does not assert a specific retention period.

The landing page includes no forms, analytics SDKs, remote fonts, or remotely loaded photographs. Its static hosting provider still receives requests from visitors. The app's hosting provider is Google/Firebase; see https://firebase.google.com/support/privacy/.

## Photo credit

`public/images/morning-light.jpg`: Aimee Giles, “A vase sitting on top of a wooden table” (morning coffee in sunlight), Unsplash.

- Source: https://unsplash.com/photos/a-vase-sitting-on-top-of-a-wooden-table-u1QfqxhsrXQ
- License: https://unsplash.com/license
- Retrieved October 22, 2026; served locally to avoid third-party image requests.

## Manual checks

Check the three walkthrough buttons, FAQ expansion, anchor navigation, and app URLs. Check narrow phone and desktop layouts, keyboard focus, image loading, and browser console errors. The actual app's alarm workflow has its own tests in `../QRise/tests`.

## GitHub Pages deployment

Live introduction: https://mythventor.github.io/CS392_Team_Repository/QRise_Ad/

The repository uses GitHub Actions as its Pages source. `.github/workflows/deploy-landing-page.yml` builds only `QRise_Ads` and publishes its `dist` output inside the artifact’s `QRise_Ad/` directory whenever landing-page files change on `main`. It can also be run manually from Actions. The Vite base path is `/CS392_Team_Repository/QRise_Ad/`, so local preview URLs include that path too.

The alarm application stays at https://qrise-cs392.web.app. GitHub Pages hosts this introduction; Google/Firebase hosts the linked app.
