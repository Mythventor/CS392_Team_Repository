# Passdown introduction website

Live page: [Passdown introduction](https://mythventor.github.io/CS392_Team_Repository/Passdown_Ad/).

A standalone static introduction to Passdown, the campus resale student prototype. App buttons link to https://passdown-cs392.web.app. The page includes original SVG illustrations, a buyer/seller walkthrough switch, FAQs, pickup guidance, and data-handling information grounded in the app's source. Example items and prices are explicitly illustrative, not live listings.

## Preview

No dependencies or build step are required. From the repository root:

```sh
python3 -m http.server 5174 --directory Passdown_Ad
```

Open http://localhost:5174. Check both walkthrough buttons, expandable FAQs, navigation, and app links at desktop and phone widths. The walkthrough works locally without accessing the app or creating real offers. Essential content and FAQs remain available without JavaScript.

## Deployment

The shared `.github/workflows/deploy-landing-page.yml` workflow builds QRise’s introduction and copies this folder's public files into the same Pages artifact under `Passdown_Ad/`. It deploys both introductions together when either changes on `main`, preserving `QRise_Ad/`. Asset paths are relative to support the repository's GitHub Pages subdirectory. This does not change the Firebase-hosted application.

The page loads no external fonts, images, analytics, or app SDKs. GitHub Pages still receives ordinary hosting requests. The linked app uses Firebase and Cloudinary; review the FAQ's wording if its data handling changes.
