# Cloudflare Web Analytics — activation runbook

Status: **not enabled**. The site currently loads no tracking script and says so in the footer.
Do not apply any change in this document until the owner supplies a beacon token and accepts the copy change.

## Why Cloudflare Web Analytics

- Free tier, no cookies, no fingerprinting, no cross-site tracking.
- Aggregate page views, referrers and Core Web Vitals.
- Fits the project's privacy position better than GA4 or a session-replay tool.
- Chosen as the analytics candidate in `vendor-assessment.md`; kept on the shortlist, not activated.

## Prerequisites

1. The repository is public and the Pages site is live (currently blocked — the repo is private).
2. A Cloudflare account (free).
3. A Web Analytics site entry for the Pages hostname (`28121978444.github.io`) or the custom domain if one is added.
4. The beacon token copied from Cloudflare. Exact dashboard labels may change; verify at activation time.

## Activation steps

1. Cloudflare dashboard → **Web Analytics** → **Add a site**.
2. Enter the hostname, choose the **JS snippet** installation method (no DNS/proxy change needed).
3. Copy the token.
4. Add this before `</head>` in `website/index.html`, replacing the existing comment block:

```html
<script defer src="https://static.cloudflareinsights.com/beacon.min.js"
        data-cf-beacon='{"token": "CLOUDFLARE_BEACON_TOKEN"}'></script>
```

5. Apply the copy diff below in the same commit.
6. Deploy, load the page once, and confirm the visit appears in the Cloudflare dashboard (allow a few minutes).
7. Add a one-line note to `website/README.md` that analytics is active and which provider is used.

## Copy diff (apply only with the script)

**`website/index.html` — footer, line ~541**

```diff
-      <p>No cookies, no analytics on this page.</p>
+      <p>Cookie-free, aggregate visit counts via Cloudflare Web Analytics. No personal data or cross-site tracking.</p>
```

**`website/index.html` — privacy card, line ~288**

```diff
-          <p>No analytics, no crash reporting, no device identifiers. There is no server to receive them.</p>
+          <p>No analytics SDK in the app, no crash reporting, no device identifiers. The app has no server to receive them.</p>
```

**`website/index.html` — FAQ, line ~480**

```diff
-          <p>None. There is no telemetry, no analytics and no crash reporting. The only network requests are the ones you enable ...</p>
+          <p>None from the app. There is no telemetry, no analytics SDK and no crash reporting. The only network requests are the ones you enable ...</p>
```

**Meta descriptions (lines 7, 11, 16):** keep as-is. They describe the app, not the page. Re-check after the edit that "no telemetry" still reads as an app claim.

## Guardrails

- No advertising or cross-site pixels.
- No cookie banner is needed only while the beacon remains cookie-free; re-verify if Cloudflare changes the product.
- If the site later adds a custom domain, update the Web Analytics hostname and the canonical/OG/sitemap URLs together.
- If analytics is rejected, delete the HTML comment placeholder and keep the current copy.
