# Toolbox — landing page

Static, dependency-free landing page for Toolbox (and the Bartender Aid mobile app). No build step, no frameworks, no external CDNs or web fonts, so the page works offline and can be served from any static host.

## Files

```
website/
├── index.html          # all sections and copy
├── styles.css          # design tokens, layout, responsive rules
├── app.js              # gallery tabs (click + arrow keys) only
├── robots.txt
├── sitemap.xml
├── README.md
└── assets/
    ├── home.png        # from docs/screenshots/home.png
    ├── updates.png     # from docs/screenshots/updates.png
    ├── bartender.png   # from docs/screenshots/bartender.png
    └── icon.png        # from build/icon.png
```

All download buttons point to `https://github.com/28121978444/toolbox-desktop/releases/latest`. There are no forms, cookies or third-party scripts.

## Preview locally

From the repository root:

```bash
python -m http.server 8080 --directory website
```

Then open <http://localhost:8080>. Any static server works (`npx serve website`, VS Code Live Server, etc.). Opening `index.html` directly via `file://` also renders, but a local server matches production behavior.

## Edit the design

- Colours, spacing, radii and the container width live as CSS custom properties in the `:root` block of `styles.css`.
- Feature card icon colours use the `.ac-*` classes plus `--accent` / `--accent-soft`.
- The layout is fluid from 360 to 1440 px, with breakpoints at 1080, 900, 640 and 420 px.
- Screenshots are referenced at their native size (1174 × 910) and scale with the layout.

## Deploy

Any static host works: GitHub Pages, Netlify, Cloudflare Pages or an object store. Upload `index.html`, `styles.css`, `app.js`, `robots.txt`, `sitemap.xml` and `assets/` together. No redirects or build settings are required.

For GitHub Pages, enable **Settings → Pages → Source: GitHub Actions**, then run the manual **Website** workflow (`.github/workflows/pages.yml`). It publishes this directory to <https://28121978444.github.io/toolbox-desktop/>. The workflow is manual because the page links to the repository, which must be public first.

Custom domain, analytics and a hosted SPA fallback are owner decisions and are intentionally not configured here. If a custom domain replaces the Pages URL, update the canonical, Open Graph and Twitter URLs in `index.html`, plus `robots.txt` and `sitemap.xml`.

## Before launch

- Replace the placeholder mobile download state in the Bartender Aid section once a store listing exists.
- Add a code-signing detail or store link to the SmartScreen FAQ once signing is in place.
- Regenerate `assets/*.png` from a current build if the UI changes.
- Verify the GitHub Pages URL above (or replace it) after the repository is public and Pages is enabled.
