# Passdown introduction website

[Live introduction](https://mythventor.github.io/CS392_Team_Repository/Passdown_Ad/) · [Marketplace app](https://passdown-cs392.web.app) · [App source](../../apps/passdown/) · [Repository overview](../../README.md)

A standalone HTML/CSS/JavaScript introduction to Passdown. It includes original SVG illustrations, a buyer/seller walkthrough switch, FAQs, pickup guidance, and data-handling information. Example listings and prices are illustrative; the page does not access the marketplace database.

## Local preview

No dependencies or build step are needed. From the repository root:

```sh
python3 -m http.server 5174 --directory sites/passdown
```

Open http://localhost:5174. Check both walkthrough buttons, FAQs, navigation, app links, and desktop/phone layouts. Essential content and FAQs work without JavaScript.

## Publishing

The shared [Pages workflow](../../.github/workflows/pages.yml) copies the four public files into the `Passdown_Ad/` directory of the Pages artifact, alongside Here!’s introduction. Source folders can change without changing the public URL. The workflow deploys both sites together on `main`.

The introduction loads no external fonts, images, analytics, or app SDKs. GitHub Pages receives ordinary hosting requests. The linked application uses Firebase and Cloudinary; recheck the FAQ whenever its data handling changes.
