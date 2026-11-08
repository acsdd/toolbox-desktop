# Toolbox — landing page

Static, dependency-free landing page for Toolbox (and the Bartender Aid mobile app). No build step, no frameworks, no external CDNs or web fonts, so the page works offline and can be served from any static host.

## Files

```
website/
├── index.html          # all sections and copy
├── styles.css          # design tokens, layout, responsive rules
├── app.js              # gallery tabs (click + arrow keys) only
├── 404.html            # static not-found page
├── robots.txt
├── sitemap.xml
├── .nojekyll           # keep Pages from running Jekyll
├── README.md
└── assets/
    ├── home.png        # from docs/screenshots/home.png
    ├── updates.png     # from docs/screenshots/updates.png
    ├── bartender.png   # from docs/screenshots/bartender.png
    ├── icon.png        # 128 px favicon derived from build/icon.png
    └── og.jpg          # 1200 × 630 social preview derived from home.png
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
- Screenshots are referenced at their native size (1164 × 901) and scale with the layout.

## Version and link checks

The three visible version labels are generated from `package.json`:

```bash
npm run site:version          # rewrite the labels
node scripts/inject-site-version.cjs --check   # fail on drift
npm run site:links            # validate local files and anchors
```

## Deploy

**The repository is currently private.** On the GitHub Free plan, GitHub Pages and public release downloads are unavailable for private repositories, so the page must not be announced yet. The workflow is manual for that reason.

Go-public checklist:

1. Run the private-repo audit (no secrets or local paths in history).
2. Make the repository public.
3. Add the `origin` remote and push `main`.
4. Enable **Settings → Pages → Source: GitHub Actions**.
5. Run the **Website** workflow (`.github/workflows/pages.yml`); it syncs the version, checks links, then publishes `website/` to <https://28121978444.github.io/toolbox-desktop/>.
6. After the first successful deploy, add the `push` trigger described in the workflow comment and keep the URL in `robots.txt` and `sitemap.xml` in sync.

Any static host also works: upload `index.html`, `styles.css`, `app.js`, `404.html`, `robots.txt`, `sitemap.xml`, `.nojekyll` and `assets/` together. No redirects or build settings are required.

Custom domain, analytics and a hosted SPA fallback are owner decisions and are intentionally not configured here. If a custom domain replaces the Pages URL, update the canonical, Open Graph and Twitter URLs in `index.html`, plus `robots.txt` and `sitemap.xml`.

## Analytics (not enabled)

The page deliberately claims **no cookies and no analytics**, and no tracking script is loaded. Cloudflare Web Analytics is the chosen zero-cost candidate if that changes.

Activation is documented in `docs/publicity/analytics-activation.md`. Do not add a beacon or change the privacy copy until an owner supplies a `CLOUDFLARE_BEACON_TOKEN` and accepts the copy diff in that document.

## Before launch

- Replace the placeholder mobile download state in the Bartender Aid section once a store listing exists.
- Add a code-signing or store detail to the SmartScreen FAQ once signing is in place (see `docs/publicity/signing-options.md`).
- Regenerate `assets/*.png` and `assets/og.jpg` from a current build if the UI changes.
- Verify the GitHub Pages URL after the repository is public and Pages is enabled.
