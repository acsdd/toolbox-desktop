# Vendor and API Readiness Assessment

**Products:** Toolbox (Electron, Windows, MIT, free) and Bartender Aid (React Native + Node/Express API)
**Prepared for:** Publicity workstream, Goal 2 item 6
**Date:** 2026-11-08
**Status:** read-only research complete. No signups, purchases, publishing, or account changes.
**Scope:** 12 vendor categories and 35 candidates, plus the vendors already in the stack (Render, Neon, GitHub, Cloudflare).

---

## Executive summary

1. **A credible zero-cost stack exists.** GitHub Pages + GoatCounter + Buttondown + Buffer + GitHub Issues + Resend + Better Stack + GitHub Actions + winget/Chocolatey covers hosting, analytics, newsletter, social scheduling, feedback, email, monitoring, and Windows distribution at **$0/month recurring**. The only unavoidable costs are store fees and an optional domain.
2. **The best paid upgrade is about $25/month:** Plausible Starter ($9) + Buttondown Basic ($9) + Render Starter ($7). That buys API access on analytics, a larger newsletter, and no 15-minute cold starts on the Bartender Aid API.
3. **Three vendors should not be used for the launch as proposed:** Vercel Hobby (non-commercial licence), Later (no public API), and Publer for automation (API is gated to a paid tier). They are fine products; they are wrong for this constraint set.
4. **The biggest non-vendor blocker is that Toolbox is unsigned.** Microsoft Store MSIX now has free developer registration and Store-managed code signing, which would remove the SmartScreen warning. The alternative is a code-signing certificate. This is a growth decision, not an IT detail.
5. **Do not add Sentry or any in-app telemetry to Toolbox by default.** It would contradict the published "no telemetry" promise. Use GitHub Issues; reserve Sentry for Bartender Aid with opt-in and PII scrubbing.
6. **Bartender Aid's API is not agent-ready (2/5).** It has no OpenAPI, no authentication, wildcard CORS, string-only errors, no rate limits, and no response schemas. Fix that before promoting the API or automating against it.
7. **Product Hunt, AlternativeTo, Softpedia, and FossHub are manual channels.** Product Hunt's API is read-mostly and does not replace the launch flow. Budget human time, not integration time.
8. **Android is the faster mobile path.** Google Play is $25 one-time and internal testing allows up to 100 testers. Production for new personal accounts needs 12 testers for 14 continuous days. iOS is $99/year and should wait for retention evidence.
9. **Verify five things at signup:** Buttondown API access on the free plan, Publer API plan gating, Dub's current free tier, UptimeRobot's commercial-use terms, and MailerLite's reduced free limits (250 subscribers / 2,500 emails).
10. **Three decisions block launch:** domain name, newsletter vendor, and the SmartScreen/signing strategy. The full decision list is in §20.

---

## 1. Method and scoring

### 1.1 Constraints and verification

- Read-only research. No account was created, no card was entered, nothing was published.
- Prices and limits were checked on **2026-11-08**. Vendors change terms; re-check before signup.
- Every vendor row cites a source in Appendix A. Items marked **⚠ unverified** are based on secondary reporting or docs that do not state the limit explicitly.
- Effort estimates assume one developer already familiar with the repo; they are first-integration estimates, not ongoing maintenance.

### 1.2 Agent and API readiness rubric (1–5)

This uses the same 8-pillar model as the 48-check API readiness framework: metadata, errors, introspection, naming, predictability, documentation, performance, and discoverability.

| Score | Label | 48-check equivalent | What it means for an agent |
|---|---|---|---|
| **5** | Excellent | 85–100, agent-ready | Formal schema (OpenAPI/GraphQL), token or OAuth auth, typed parameters, structured errors, documented limits, pagination/webhooks, examples. |
| **4** | Agent-ready with caveats | 70–84, agent-ready | Documented API and auth, predictable patterns, but one or two gaps (no OpenAPI, paid gating, partial write access). |
| **3** | Needs work | 50–69 | API exists but is incomplete, poorly documented, paid-gated, or requires human steps. Agents need supervision. |
| **2** | Not ready | 30–49 | No public API. Only UI, email, or brittle browser automation. A human must do it. |
| **1** | Manual only | 0–29 | No API and no practical automation path. |

**Readiness is not product quality.** AlternativeTo scores 2/5 because it has no API, but it is still worth a manual submission. The score answers one question: *can an agent operate this vendor without a human?*

### 1.3 How to read the tables

Each category table covers: API and auth, free tier and hard limits, readiness, integration effort, data ownership/lock-in, GDPR/privacy note, and verdict. Notes below each table explain the non-obvious parts and the recommendation.

---

## 2. Static hosting

| Vendor | API / auth | Free tier and hard limits | Readiness | Effort | Ownership / lock-in | GDPR note | Verdict |
|---|---|---|---|---|---|---|---|
| **GitHub Pages** | Git push or Actions; REST Pages API; GitHub token/SSH | 1 GB site; 100 GB/month bandwidth soft limit; 10 builds/hour soft limit; public repo required on GitHub Free | **4/5** — git/Actions deploy, stable API, no preview environments | 1–2 h | Static files stay in the repo; low lock-in | GitHub/Microsoft DPA; access logs; static only | **Adopt (default)** |
| **Cloudflare Pages** | API token; Wrangler; Git integration; REST API | 500 builds/month; 20 concurrent builds; 20,000 files per deployment; unlimited bandwidth and requests | **4/5** — good API and CLI, more moving parts | 3–4 h | Static output; low lock-in; Cloudflare config | Cloudflare DPA; EU options; free Web Analytics | **Optional (scale/edge)** |
| **Netlify** | OAuth/PAT; deploy API; CLI | Free plan is **300 credits/month**; bandwidth costs 20 credits/GB (≈15 GB if all credits go to bandwidth); builds also consume credits | **5/5** — strong deploy API, previews, forms, functions | 2 h | Build config and functions add medium lock-in | Netlify offers a DPA; verify processing region and sub-processors before launch | **Optional** |
| **Vercel** | Bearer token; REST API; CLI | Hobby: 100 GB fast data transfer; 10 GB fast origin transfer; 1M CDN requests; **personal, non-commercial use only** | **5/5** — excellent API and DX | 2 h | Medium–high if Next.js features are used | Vercel offers a DPA; verify processing region before launch | **Reject for launch** |

**Notes**

- **GitHub Pages is the default** because the repo is already on GitHub and the release workflow already exists. Custom domains and HTTPS are supported. The limits are soft, and a launch landing page will not approach 100 GB/month. The trade-off is no preview deployments and no server-side logic.
- **Cloudflare now positions Workers static assets as the path for new projects**; Pages remains supported and has generous bandwidth. If you start fresh on Cloudflare, use Workers static assets (free plan includes 100,000 requests/day). Do not operate both Pages and Workers for the same site.
- **Netlify's free plan changed to a credit model.** The old "100 GB bandwidth + 300 build minutes" figures are legacy. 300 credits is roughly 15 GB of bandwidth, which is fine for launch but less predictable than GitHub Pages.
- **Vercel Hobby is explicitly non-commercial.** A free open-source app with no revenue might qualify, but the licence ambiguity is unnecessary for a static landing page. Reject for this project; revisit only if a commercial product site or Next.js runtime is needed.

**Recommendation:** GitHub Pages for launch. Move to Cloudflare Workers static assets if traffic exceeds the 100 GB/month soft limit or edge redirects are needed. Use Cloudflare DNS and Cloudflare Web Analytics either way.

Sources: [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [GitHub Pages custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [Cloudflare Workers static assets](https://developers.cloudflare.com/workers/static-assets/), [Netlify pricing](https://www.netlify.com/pricing/), [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Vercel pricing](https://vercel.com/pricing).

---

## 3. Privacy analytics

| Vendor | API / auth | Free tier and hard limits | Readiness | Effort | Ownership / lock-in | GDPR note | Verdict |
|---|---|---|---|---|---|---|---|
| **GoatCounter** | REST `/api/v0`; per-site bearer token; published OpenAPI 2.0 contract | Hosted free for "reasonable public usage"; no published hard cap (≈100k pageviews/month is commonly cited **⚠ unverified**); self-host unlimited | **4/5** — simple REST, token auth, clear docs; small API surface | 1 h | Data export; self-host escape; low lock-in | Cookie-free; no personal data; EU-friendly; check hosted DPA | **Adopt** |
| **Umami Cloud** | REST API v2; API key (Pro and above) | Hobby: **1 website, 100k events/month, no API**; Pro **$20/month** includes API | **3/5** — API exists but not on free; 1-site cap | 1–2 h | Export; self-host escape; low–medium lock-in | Cookie-free; verify DPA and data region on the paid plan | **Optional (paid)** |
| **Umami self-host** | REST API v2; API keys (v3.4+); self-hosted auth | Unlimited events/websites; server and Postgres cost only | **4/5** — good API, full control; you own uptime and upgrades | 3–4 h + maintenance | Full ownership; low lock-in | Full control; you are the processor; EU hosting possible | **Optional (ownership)** |
| **Plausible** | Stats API and Sites API; bearer API key | **No free tier**; 30-day trial; Starter **$9/month** for 10k pageviews | **5/5** — mature API, clean docs, predictable | 1 h | Data export; low lock-in | Cookie-free; EU-based; strong GDPR posture | **Optional (paid)** |
| **Cloudflare Web Analytics** | GraphQL Analytics API; API token | Free; no published pageview cap; privacy-first RUM | **3/5** — API is generic GraphQL; limited event/UTM model | 0.5 h | Limited export; low–medium lock-in | Cookie-free; Cloudflare DPA; no cross-site tracking | **Adopt (secondary)** |

**Notes**

- **GoatCounter is the best zero-cost choice** because it combines a real API, cookie-free tracking, referrer/UTM reporting, and a free hosted tier. The hosted service is fair-use, not a hard SLA; if usage grows, self-host.
- **Umami Cloud's free plan does not include API access.** This is the deciding detail. The free plan is fine for a dashboard, but an agent or automation cannot query it. Self-hosted Umami is the better Umami option if API access and ownership matter.
- **Plausible has no free tier.** At $9/month it is the best paid analytics option for this project, but it is not part of the zero-cost stack.
- **Cloudflare Web Analytics is a useful second source** because it is free and independent of the app. It is not a full product-analytics tool: no event model, no funnels, and limited UTM handling. Use it for traffic sanity checks, not acquisition decisions.
- All five options are cookie-free. That reduces consent-banner scope, but you still need a privacy policy that names the analytics processor.

**Recommendation:** GoatCounter hosted as primary, Cloudflare Web Analytics as secondary. If the owner wants full ownership and API access, self-host Umami. If budget is approved, Plausible Starter.

Sources: [GoatCounter](https://www.goatcounter.com/), [GoatCounter API](https://goatcounter.com/help/api), [Umami pricing](https://umami.is/pricing), [Umami API](https://docs.umami.is/docs/api), [Umami source](https://github.com/umami-software/umami), [Plausible subscription plans](https://plausible.io/docs/subscription-plans), [Plausible Stats API](https://plausible.io/docs/stats-api), [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/), [Cloudflare GraphQL Analytics API](https://developers.cloudflare.com/analytics/graphql-api/).

---

## 4. Newsletter

| Vendor | API / auth | Free tier and hard limits | Readiness | Effort | Ownership / lock-in | GDPR note | Verdict |
|---|---|---|---|---|---|---|---|
| **Buttondown** | REST API; API key | **Free up to 100 subscribers**; custom-domain sending included; pricing assumes at most one email/day | **4/5** — clean REST API and docs; free-plan API access not stated on pricing **⚠ verify** | 1–2 h | Subscriber export; low lock-in | US processor; consent and DPA required; double opt-in | **Adopt (launch)** |
| **MailerLite** | REST API v2; API token | **Free: 250 subscribers, 2,500 emails/month, 2 seats**; paid plans from ~$10/month **⚠ approximate** | **4/5** — mature API, automations, EU vendor | 2 h | Export; medium lock-in if automations are built | EU-based (Lithuania); strong GDPR fit; DPA | **Optional (EU-first)** |
| **Kit (ConvertKit)** | REST API v4; API key | **Free up to 10,000 subscribers**; unlimited email sends; 1 user; **no visual automations or sequences on Free** | **4/5** — API available on Free, large free list, fewer automation features | 2 h | Export; medium lock-in if forms/landing pages are used | US processor; DPA/SCCs; consent required | **Optional (scale)** |

**Notes**

- **Buttondown is the best launch fit** for a developer audience: simple REST API, markdown emails, custom-domain sending, and a genuinely free 100-subscriber tier. The one caveat is that the pricing page does not mention API access; the API documentation exists and is public, but confirm that the free plan can create subscribers before wiring the form.
- **MailerLite is the GDPR-friendly option** for a Romania/EU audience: EU-based, 250 free subscribers, 2,500 emails/month, 2 seats. The free limits were reduced in 2025–2026; do not plan around the old 1,000-subscriber/12,000-email figures.
- **Kit is the scale option**: 10,000 free subscribers and unlimited sends is unusually generous, and API access is included on Free. The catch is that automations and sequences are paid, so the free plan is a broadcast tool, not a lifecycle engine.
- **Do not use Resend as the newsletter platform.** Resend is for transactional email; it does not provide subscriber management, unsubscribe handling, or broadcast compliance.
- GDPR: use double opt-in, record consent timestamp/source, publish a privacy policy, sign a DPA, and keep an export path. Avoid importing purchased lists.

**Recommendation:** Buttondown for launch. Add a switch trigger at 90 subscribers: move to Kit for scale or MailerLite for EU data residency. Keep the subscriber list exportable in all cases.

Sources: [Buttondown pricing](https://buttondown.com/pricing), [Buttondown API](https://docs.buttondown.com/api-introduction), [MailerLite free plan](https://www.mailerlite.com/free-plan), [MailerLite pricing](https://www.mailerlite.com/pricing), [MailerLite API](https://developers.mailerlite.com/docs), [Kit pricing](https://kit.com/pricing), [Kit API v4](https://developers.kit.com/v4).

---

## 5. Social scheduling

| Vendor | API / auth | Free tier and hard limits | Readiness | Effort | Ownership / lock-in | GDPR note | Verdict |
|---|---|---|---|---|---|---|---|
| **Buffer** | REST API (GA); personal API key or OAuth app client | Free: 3 channels; 10 scheduled posts per channel at a time; 1 API key; 150 requests/15 min; 600/day; 1,000/channel up to 3,000/30 days | **4/5** — API on Free, clear limits, good docs | 1–2 h | Post history export; low lock-in | US processor; DPA; social platform data | **Adopt** |
| **Publer** | REST API; API key | Free: 3 social accounts; 10 scheduled posts/account; 25 drafts; API gated to Business (~$21/month) **⚠ third-party claim** | **3/5** — API exists but not on Free; paid gate | 2 h | Medium lock-in; workspace data | Verify DPA, data region and sub-processors before use | **Reject for zero-cost automation** |
| **Postiz** | REST API; API key; self-host | Self-host free (AGPL-3.0); no channel limits; hosted from **$29/month** | **4/5** — real API, self-host escape; you run the server | 4–6 h | Full ownership when self-hosted; low lock-in | Full control; you are the processor; EU hosting possible | **Optional (self-host)** |
| **Later** | **No documented public API** | Free plan is heavily capped (1 social set; roughly 5–12 posts/month depending on source **⚠ conflicting**); paid plans for volume | **2/5** — dashboard only; no automation path | 0 h (manual) | High; no export/automation path | US processor; DPA; platform data | **Reject for automation** |

**Notes**

- **Buffer is the clear zero-cost winner** because its API is available on the Free plan, with published rate limits and a simple key model. Three channels and ten queued posts per channel are enough for a launch cadence.
- **Publer's free plan is competitive for manual scheduling**, but its API is reportedly reserved for Business. If API access is the requirement, the effective price is ~$21/month, which breaks the zero-cost constraint. Verify on the plans page before deciding.
- **Postiz is the self-host option** for teams that want scheduling without a per-channel subscription. It is AGPL-3.0, so modifications used as a network service have source-availability obligations. Budget server time and upgrades, not just install time.
- **Later has no public API.** It is a manual scheduler. It is not suitable for an agent-driven workflow, and its free plan is too limited for a launch cadence.

**Recommendation:** Buffer Free. Use manual posting for TikTok/Instagram Reels if Buffer's format support is insufficient. Postiz only if the owner accepts server maintenance.

Sources: [Buffer API](https://buffer.com/api), [Buffer developer portal](https://developers.buffer.com/), [Buffer pricing](https://buffer.com/pricing), [Publer plans](https://publer.com/plans), [Publer API](https://publer.com/docs), [Postiz pricing](https://postiz.com/pricing), [Postiz source](https://github.com/gitroomhq/postiz-app), [Postiz docs](https://docs.postiz.com/), [Later alternatives analysis](https://www.outstand.so/blog/later-alternatives) (third-party, no-API claim).

---

## 6. Launch and directories

| Vendor | API / auth | Free tier and hard limits | Readiness | Effort | Ownership / lock-in | GDPR note | Verdict |
|---|---|---|---|---|---|---|---|
| **Product Hunt** | GraphQL API; OAuth user flow, client-only token, PKCE, or developer token | Free to launch; API has 6,250 complexity points/15 min; launch is manual; 12:01 AM PT; can schedule up to 1 month ahead | **3/5** — API is read-mostly; launch creation is a human web flow | 3–4 h prep + launch day | Public listing; no lock-in | US platform; public data; DPA for account | **Adopt (manual)** |
| **AlternativeTo** | No public API; web account | Free submission; moderation; requires app details and alternatives | **2/5** — human-only submission | 1 h | Public listing; no lock-in | Public data; EU/US visitors | **Adopt (manual)** |
| **Softpedia** | No public API; web form | Free submission; review typically ~14 days **⚠ third-party estimate** | **2/5** — human-only submission | 1 h + wait | Public listing; download hosting optional | Public data; EU/US visitors | **Adopt (manual)** |
| **FossHub** | No public API; contact form | Free; curated; may host binaries; acceptance not guaranteed | **2/5** — human-only submission | 1 h + review | If they host binaries, medium lock-in | Public data; US-hosted | **Optional (manual)** |

**Notes**

- **Product Hunt is a one-shot launch, not an integration.** The API supports reading posts, users, and goals; write access is partial and use-case gated. Do not plan to create a launch via API. Prepare the gallery, tagline, first comment, and hunter relationship in advance.
- **AlternativeTo is a long-tail discovery channel.** Submit the app as an alternative to established Windows toolboxes and note the local-first/privacy angle. Moderation can take days.
- **Softpedia adds a download listing and backlink.** Submit early because the review is slow. Keep the installer URL stable and versioned.
- **FossHub is selective.** It is a good fit for MIT/FOSS utilities, but acceptance is not guaranteed and they may want to host the binaries. Treat it as optional upside.
- None of these directories provides a reliable API for submission. Build a checklist and a status sheet; do not build scrapers.

**Recommendation:** Do all four manually. Product Hunt first, AlternativeTo and Softpedia in parallel, FossHub if accepted. Track status and follow-ups in a single sheet.

Sources: [Product Hunt launch guide](https://www.producthunt.com/launch), [Product Hunt preparing for launch](https://www.producthunt.com/launch/preparing-for-launch), [Product Hunt API](https://api.producthunt.com/v2/docs), [Product Hunt rate limits](https://api.producthunt.com/v2/docs/rate_limits/headers), [AlternativeTo FAQ](https://alternativeto.net/faq/), [Softpedia submission](https://win.softpedia.com/contact_submit.shtml), [Softpedia terms](https://www.softpedia.com/user/terms.shtml), [FossHub signup](https://www.fosshub.com/signup.html).

---

## 7. Windows distribution

| Vendor | API / auth | Free tier and hard limits | Readiness | Effort | Ownership / lock-in | GDPR note | Verdict |
|---|---|---|---|---|---|---|---|
| **winget-pkgs** | GitHub PR/API; GitHub token; `wingetcreate` | Free; manifest with installer URL + SHA256; automated validation; unsigned installers accepted but SmartScreen remains | **5/5** — schema-driven, automated validation, stable workflow | 2–4 h first package; ~30 min per release | Manifest is public in the repo; no lock-in | No user data; Microsoft/GitHub terms | **Adopt** |
| **Chocolatey** | NuGet push API key; `choco push` | Free community repo; human moderation + virus scan; checksum required; silent install required; no paid listing fee | **4/5** — documented package format and API; moderation adds latency | 3–5 h first package; ~1 h per release | Package in community repo; no lock-in | No user data; community moderation | **Adopt (second)** |
| **Microsoft Store (MSIX)** | Partner Center / Microsoft Entra; Store submission API and CLI | **Free individual and company registration in 2026**; Store-managed code signing at no cost; MSIX packaging and certification required | **4/5** — submission API/CLI, but MSIX packaging is real work | 8–16 h first submission | Medium: Store policies, certification, package identity | Microsoft DPA; Store privacy policy required | **Optional / strategic** |

**Notes**

- **winget is the highest-leverage Windows channel.** It is free, schema-driven, and automatable. The manifest pins the installer URL and SHA256; `wingetcreate` can generate and submit the manifest. Unsigned installers are accepted, but SmartScreen still warns users. First package 2–4 hours; subsequent releases are mostly automation.
- **Chocolatey is worth doing after winget.** The community repo is free but human-moderated, with virus scanning and checksum checks. The NSIS installer supports silent install (`/S`), which the package needs. Expect moderation latency on the first package.
- **Microsoft Store is now free to join, and Microsoft signs MSIX packages for free.** That is the cleanest long-term fix for the SmartScreen warning: users install from the Store, and the package is trusted. The cost is packaging and certification effort, not money. Electron apps can be packaged as MSIX, but test the per-user data paths, portable build, and update flow first.
- **Do not submit the portable EXE to the Store.** Use the NSIS installer or a proper MSIX package. Keep GitHub Releases as the canonical artifact and the Store as an additional trusted channel.
- If the Store path is deferred, a code-signing certificate is the alternative. Budget roughly $200–500/year depending on OV/EV and CA **⚠ verify current pricing**. That is a separate purchase decision.

**Recommendation:** winget first, Chocolatey second, Microsoft Store MSIX as the strategic SmartScreen fix. The Store is free but not cheap in engineering time; decide before the launch push.

Sources: [winget repository submission](https://learn.microsoft.com/en-us/windows/package-manager/package/repository), [wingetcreate](https://github.com/microsoft/winget-create), [Chocolatey moderation](https://docs.chocolatey.org/en-us/community-repository/moderation/), [Chocolatey package creation](https://docs.chocolatey.org/en-us/create/create-packages/), [Microsoft Store free individual registration](https://learn.microsoft.com/en-us/windows/apps/publish/whats-new-individual-developer), [Microsoft Store free company registration](https://blogs.windows.com/windowsdeveloper/2026/05/07/publish-to-microsoft-store-as-a-company-now-with-free-registration-and-faster-onboarding/), [Windows code signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options), [MSIX signing guide](https://learn.microsoft.com/en-us/windows/msix/package/sign-msix-package-guide), [Store submission API](https://learn.microsoft.com/en-us/windows/apps/publish/store-submission-api).

---

## 8. Mobile distribution

| Vendor | API / auth | Free tier and hard limits | Readiness | Effort | Ownership / lock-in | GDPR note | Verdict |
|---|---|---|---|---|---|---|---|
| **Google Play** | Play Developer API; Google service account | **$25 one-time** registration; internal testing up to **100 testers**; new personal accounts need **12 testers for 14 continuous days** of closed testing before production **⚠ verify in console**; developer verification required | **4/5** — real API, automated uploads, clear tracks | 4–8 h | Medium: Play policies, data safety form, review | Google DPA; Data safety form; privacy policy | **Adopt (internal first)** |
| **Apple App Store** | App Store Connect API; JWT | **$99/year**; TestFlight up to **10,000 external testers**; App Review required | **4/5** — strong API, but review and platform rules add friction | 8–16 h | Medium–high: App Review, privacy labels, platform fees | Apple DPA; privacy nutrition labels; ATT if tracking | **Optional / defer** |

**Notes**

- **Google Play is the faster path to real users.** Internal testing is available within minutes and supports up to 100 testers. The production gate is the important part: personal accounts created after 2023-11-13 need 12 testers opted in for 14 continuous days before applying for production. Internal testing does not count toward that requirement. Plan at least three weeks from closed-test start to production.
- **Google Play developer verification** is now part of the ecosystem. Register the app and developer identity in Play Console; the September 30, 2026 deadlines apply to participating stores in specific countries. Verify the current requirement for Romania before submission.
- **Apple is a different acquisition channel, not a checkbox.** $99/year plus App Review plus privacy labels is justified only after Android retention data shows the app is worth the port. TestFlight's 10,000 external testers is generous, but review still applies to the production build.
- For Bartender Aid, prepare a privacy policy and a data safety/privacy nutrition label that matches the actual data flow. The current backend has no accounts and no auth; if that changes, the disclosures must change too.

**Recommendation:** Android internal testing now, production after the 12-tester/14-day gate. Defer iOS until 30-day retention is measured. Do not buy Apple's membership before the app is ready to submit.

Sources: [Google Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en), [Google Play internal/closed/open testing](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en), [Google Play registration fee](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en), [Android developer verification](https://developer.android.com/blog/posts/android-developer-verification-rolling-out-to-all-developers-on-play-console-and-android-developer-console), [Google Play 12-tester analysis](https://primetestlab.com/blog/google-play-changed-20-to-12-testers) (third-party), [Apple Developer Program](https://developer.apple.com/programs/), [Apple membership details](https://developer.apple.com/programs/whats-included/), [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi).

---

## 9. Feedback and crash reporting

| Vendor | API / auth | Free tier and hard limits | Readiness | Effort | Ownership / lock-in | GDPR note | Verdict |
|---|---|---|---|---|---|---|---|
| **GitHub Issues** | REST and GraphQL; PAT or GitHub App | Free for public repos; 5,000 authenticated REST requests/hour; issue templates already in the repo | **5/5** — excellent API, webhooks, predictable | 0.5 h | Data in GitHub; low–medium lock-in | GitHub DPA; public issue content | **Adopt** |
| **Sentry** | DSN for ingest; API token for management; SDKs | Free Developer: **5,000 errors/month, 1 user, 50 replays, 5 GB logs** | **4/5** — strong SDK/API, but event data is sensitive | 2–4 h | Medium; self-host option; event export | US processor; DPA; PII scrubbing; opt-in required | **Adopt for Bartender Aid only; reject for Toolbox default** |

**Notes**

- **GitHub Issues is the default for both products.** It is free, already where the code lives, and has a strong API for triage automation. The repo is adding issue templates and a stale workflow, which is the right foundation.
- **Sentry would violate Toolbox's privacy promise if enabled by default.** The README says "No telemetry, analytics or crash reporting." Adding Sentry silently would make that statement false. If crash reporting is wanted, make it explicitly opt-in, disclose the data collected, scrub PII, and update the privacy notes. Until then, GitHub Issues is the correct channel.
- **Sentry is reasonable for Bartender Aid** because it has a server and a mobile client where crash context is genuinely useful. Still use opt-in for mobile, scrub user data, and document retention. The free 5,000 errors/month is enough for early beta.
- Do not add analytics SDKs to Toolbox either. Web analytics on the landing page is separate from in-app telemetry.

**Recommendation:** GitHub Issues for both. Sentry Free for the Bartender Aid backend and Android beta with consent and scrubbing. No in-app telemetry in Toolbox.

Sources: [GitHub Issues API](https://docs.github.com/en/rest/issues/issues), [Sentry pricing](https://sentry.io/pricing/), [Sentry API](https://docs.sentry.io/api/), [Sentry Electron data collected](https://docs.sentry.io/platforms/javascript/guides/electron/data-management/data-collected/).

---

## 10. Short links and UTM

| Vendor | API / auth | Free tier and hard limits | Readiness | Effort | Ownership / lock-in | GDPR note | Verdict |
|---|---|---|---|---|---|---|---|
| **Dub.co** | REST API; API key | Free tier reported as **25 new links/month, 1,000 tracked events/month, 30-day analytics retention** **⚠ not visible on current pricing page**; Pro ~$30/month; self-host AGPL-3.0 | **4/5** — good API, but free-tier uncertainty | 1 h | Low–medium; self-host escape | US processor; click data; DPA; self-host for control | **Optional** |
| **Cloudflare Worker (self-host)** | Cloudflare API token; Wrangler; code | Workers free: 100,000 requests/day; KV/D1 free quotas apply | **3/5** — you build and own the redirect logic | 2–3 h | Full ownership; low lock-in | Full control; you define retention | **Optional** |
| **Direct UTM links** | None | Free | **5/5** for humans; no API needed | 0.5 h | None | No third-party click tracking | **Adopt (default)** |

**Notes**

- **Direct UTM links are enough for launch.** Define a convention (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`), generate links in a sheet or script, and let GoatCounter attribute them. This avoids another vendor and another privacy surface.
- **Dub is useful for social bios and print/QR links** where a short branded URL matters. The current pricing page emphasizes Business/Advanced plans; the free tier is reported by third parties but not clearly shown. Verify before relying on it. If the free tier is gone, use a Cloudflare Worker or skip short links.
- **Self-hosting Dub or a Worker** gives full ownership but adds a service to monitor. For a two-app launch, direct links are the better default.

**Recommendation:** Direct UTM links for everything. Add Dub Free only if a short branded link is needed for social bios, and verify the free limits first.

Sources: [Dub pricing](https://dub.co/pricing), [Dub API](https://dub.co/docs/api-reference/introduction), [Dub source](https://github.com/dubinc/dub), [Cloudflare Workers](https://developers.cloudflare.com/workers/).

---

## 11. Email sending

| Vendor | API / auth | Free tier and hard limits | Readiness | Effort | Ownership / lock-in | GDPR note | Verdict |
|---|---|---|---|---|---|---|---|
| **Resend** | REST API; API key | Free: **3,000 emails/month, 100/day, 3 domains, 30-day retention**; Pro $20/month for 50k | **5/5** — excellent API, SDKs, idempotency, logs | 1–2 h | Low–medium; export logs; domain setup is portable | US processor; DPA; transactional data; SPF/DKIM required | **Adopt (transactional)** |

**Notes**

- **Resend is for transactional email, not newsletters.** Use it for welcome messages, download links, passwordless login (if ever added), and receipts. Use Buttondown/Kit/MailerLite for broadcasts and unsubscribe management.
- The free plan's 100/day cap is the real constraint. A launch spike can hit it; batch or queue transactional sends, and do not route the newsletter through Resend.
- Domain verification (SPF/DKIM, and ideally DMARC) is required for deliverability. This is the main setup step. Without a domain, Resend's test sender is for testing only.
- Keep marketing and transactional streams separate to protect deliverability and consent records.

**Recommendation:** Resend Free for transactional email only. Pair with Buttondown for the newsletter. Do not use one vendor for both unless it is a full newsletter platform.

Sources: [Resend pricing](https://resend.com/pricing), [Resend API](https://resend.com/docs/api-reference).

---

## 12. Automation

| Vendor | API / auth | Free tier and hard limits | Readiness | Effort | Ownership / lock-in | GDPR note | Verdict |
|---|---|---|---|---|---|---|---|
| **n8n (self-host)** | REST API; API key; webhooks | Free self-host under the Sustainable Use License (fair-code); server and maintenance cost only | **4/5** — good API and huge integration library; you run it | 4–6 h | Full ownership; low lock-in | Full control; you are the processor; EU hosting possible | **Optional** |
| **Apify** | REST API; API token | Free: **$5/month usage credit**, $0.20/compute unit; Starter $19/month | **4/5** — strong API and Actors; credit budget is small | 1–2 h | Low–medium; run data export | US processor; DPA; scraping compliance is your responsibility | **Optional** |

**Notes**

- **GitHub Actions is the automation backbone for this project.** The repo is already adding CI, stale management, release notes, and a weekly publicity checklist. Those are scheduled tasks with code access; n8n adds a server and a second scheduler for little benefit.
- **n8n is justified only for cross-service workflows** that GitHub Actions cannot reach, e.g., pulling form submissions, enriching leads, or orchestrating multiple social APIs. If used, self-host on a small server and back up the database.
- **Apify's $5/month credit is a sample, not a budget.** It is useful for a one-off scrape (directory checks, social listening, competitor pricing) but not for continuous monitoring. Do not make it a dependency of the launch.
- Any scraping must respect robots.txt, terms of service, and GDPR. Do not scrape personal data from social platforms.

**Recommendation:** GitHub Actions for scheduled work. n8n only if a concrete cross-service workflow appears. Apify only for a specific, bounded scrape.

Sources: [n8n Community license](https://docs.n8n.io/n8n-community-license), [n8n API](https://docs.n8n.io/api/), [Apify pricing](https://apify.com/pricing), [Apify API](https://docs.apify.com/api/v2).

---

## 13. Uptime and status monitoring

| Vendor | API / auth | Free tier and hard limits | Readiness | Effort | Ownership / lock-in | GDPR note | Verdict |
|---|---|---|---|---|---|---|---|
| **UptimeRobot** | REST API v2; API key | Free: **50 monitors, 5-minute checks, 1 status page**; API included | **4/5** — simple API, mature product | 0.5 h | Low; monitor config export | US processor; minimal data; check commercial terms | **Optional (secondary)** |
| **Better Stack** | REST API; API token | Free: **10 monitors, 10 heartbeats, 3-minute checks, status page**; API included | **4/5** — good API, modern status page | 0.5 h | Low–medium; status page branding | Verify DPA and data region; monitors hold minimal data | **Adopt (primary)** |
| **Uptime Kuma** | Self-host; Socket.io + Prometheus metrics; limited REST | Free, MIT; you run the server; status page included | **3/5** — no full official REST API; operational overhead | 2–3 h + maintenance | Full ownership; low lock-in | Full control; EU hosting possible | **Optional** |

**Notes**

- **Better Stack Free is the best default** because 3-minute checks and a status page are enough for a launch, and the API is usable. Ten monitors cover the landing page, the latest Release URL, the Bartender Aid health endpoint, and a few synthetic checks.
- **UptimeRobot Free gives more monitors (50) but slower checks (5 minutes).** It is a good secondary/backup. Its free-plan terms have been described as personal/non-commercial in some sources; the official help page says there is no personal-only restriction. Verify the current terms before using it for a product.
- **Monitoring Bartender Aid's `/api/health` has a useful side effect:** a 3-minute check keeps the Render free web service from sleeping after 15 minutes idle. That improves mobile cold-start UX, but it is not a substitute for upgrading to Render Starter if traffic grows.
- **Uptime Kuma** is the self-host option. It is capable and free, but it has no full official REST API, so automation is limited to Prometheus metrics and badge endpoints. Use it only if the owner wants one more service to run.

**Recommendation:** Better Stack Free primary, UptimeRobot Free secondary. Monitor: landing page, latest GitHub Release asset, Bartender Aid `/api/health`, and the newsletter signup endpoint.

Sources: [UptimeRobot free plan](https://help.uptimerobot.com/en/articles/11604710-who-should-use-uptimerobot-s-free-plan), [UptimeRobot API](https://uptimerobot.com/api/), [Better Stack uptime](https://betterstack.com/uptime), [Better Stack API](https://betterstack.com/docs/uptime/api/), [Uptime Kuma](https://github.com/louislam/uptime-kuma), [Uptime Kuma API docs](https://github.com/louislam/uptime-kuma/wiki/API-Documentation).

---

## 14. Adjacent vendors already in the stack

These were not in the original category list but are required for the products to run.

| Vendor | Role | API / auth | Limits and cost | Readiness | GDPR / lock-in | Verdict |
|---|---|---|---|---|---|---|
| **Render** | Bartender Aid backend hosting | REST API; API key | Free web service sleeps after 15 minutes idle; Starter **$7/month** (0.5 CPU, 512 MB); health check `/api/health` already configured | **4/5** | US/EU regions; DPA; low–medium lock-in | **Keep Free for beta; upgrade to Starter before launch** |
| **Neon** | Postgres for Bartender Aid | REST API; API key | Free: 100 projects, **1 GB/project**, **100 CU-hours/month**; paid usage-based | **5/5** | EU/US regions; DPA; standard Postgres, low lock-in | **Adopt** |
| **GitHub** | Source, Releases, Actions, Issues | REST/GraphQL; PAT/GitHub App | Public repos free; Actions free for standard runners on public repos; Releases API stable | **5/5** | GitHub DPA; public/private repo controls | **Adopt** |
| **Cloudflare DNS / Registrar** | DNS, domain, Web Analytics | REST API; API token | DNS free; Registrar at-cost (≈$10–15/year for .com **⚠ verify at checkout**); Web Analytics free | **5/5** | Cloudflare DPA; EU options | **Adopt** |

**Notes**

- **Render free cold starts are a real UX problem for a mobile app.** The first request after 15 minutes idle takes about a minute to wake. The repo already has `keepAlive.js` and a database keep-alive; a 3-minute uptime monitor also keeps the service warm. For a public launch, $7/month for Starter is the cleaner fix.
- **Neon Free is sufficient for early Bartender Aid usage** (1 GB/project, 100 CU-hours/month). Watch compute hours if the keep-alive query runs frequently.
- **GitHub Actions is free for public repositories** on standard runners. The repo's new CI/stale/release-notes workflows fit this model. Self-hosted runners have a separate platform charge introduced in 2026; not relevant here.
- **Cloudflare Registrar sells at cost.** A .com is roughly $10–15/year depending on the registry price. The domain is needed for branded newsletter sending, Resend, and a canonical site URL; it is not needed if the launch uses `github.io` and a Buttondown subdomain.

Sources: [Render free tier](https://render.com/docs/free), [Render pricing](https://render.com/pricing), [Neon pricing](https://neon.com/pricing), [Neon plans](https://neon.com/docs/introduction/plans), [GitHub Actions billing](https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions), [GitHub Releases API](https://docs.github.com/en/rest/releases/releases), [Cloudflare Registrar](https://www.cloudflare.com/domains/).

---

## 15. Our own API readiness

The vendor assessment asks whether external APIs are agent-ready. The same question applies to our own surfaces, because the publicity plan depends on them.

### 15.1 Toolbox

Toolbox has **no public network API**. Its integration surfaces are:

1. **GitHub Releases API** — documented, token-authenticated, paginated, rate-limited. **5/5.** Agents can find the latest release and asset URLs reliably.
2. **Update manifest** — a small JSON contract (`version`, `url`, `notes`, `publishedAt`) documented in the README. **3/5.** It has no JSON Schema, no version field for the schema itself, no error semantics, and no validation examples. An agent can read the README, but it cannot validate a manifest before publishing.

**Minimum fix:** add `schema/update-manifest.schema.json` (JSON Schema 2020-12), validate manifests in CI, and document what happens on malformed input. This is a 1–2 hour task and makes the release/update path agent-verifiable.

### 15.2 Bartender Aid API

The backend exposes three endpoints:

- `GET /api/health`
- `GET /api/ingredients`
- `POST /api/match` with `{ "ingredientIds": [1,2,3] }`

**Findings against the 48-check framework:**

| Pillar | Finding | Severity |
|---|---|---|
| Metadata | No OpenAPI document, no operationIds, no summaries/descriptions | Critical |
| Errors | Errors are `{ "error": "string" }`; no machine-readable code, no field-level details, no retry guidance | Critical |
| Introspection | No request/response schemas, no examples, no enums, no format specifiers | Critical |
| Naming | Paths are RESTful (`/api/ingredients`, `/api/match`); method semantics are correct | Pass |
| Predictability | List responses are bare arrays; no envelope, pagination, or consistent null policy | High |
| Documentation | No auth docs, no rate limits, no examples | High |
| Performance | No rate limiting, no rate-limit headers, no caching policy | High |
| Discoverability | No OpenAPI, no server URL contract beyond Render, no contact/license metadata | High |

**Score: 2/5 (Needs Work, not agent-ready).** The API is small and readable by a human, but an agent cannot reliably construct requests or recover from errors without a schema, auth, and machine-readable error codes.

**Fix order (highest impact first):**

1. Publish an OpenAPI 3.1 document with operationIds, summaries, request/response schemas, and examples.
2. Replace `{error: string}` with `{code, message, details}` and document 400/429/500.
3. Add API-key or JWT auth; replace `cors()` wildcard with an allowlist.
4. Add rate limiting and `RateLimit-*` / `Retry-After` headers.
5. Validate `ingredientIds` with a schema and return field-level errors.
6. Add a response envelope and pagination for list endpoints if the dataset grows.

This is relevant to the publicity plan because any agent, monitoring tool, or partner integration built against Bartender Aid will hit these gaps. Fix before promoting the API.

---

## 16. Recommended zero-cost stack

Recurring cost: **$0/month**. One-time/optional costs are listed separately.

| Layer | Choice | Why this one |
|---|---|---|
| Site hosting | **GitHub Pages** | Repo already on GitHub; 100 GB/month soft limit; HTTPS custom domain; Actions deploy |
| DNS + secondary analytics | **Cloudflare DNS + Web Analytics** | Free, cookie-free, independent traffic check |
| Product analytics | **GoatCounter hosted** | Free fair use, API, UTM/referrer reporting, cookie-free |
| Newsletter | **Buttondown Free** | 100 subscribers, REST API, custom-domain sending; switch at 90 subscribers |
| Social scheduling | **Buffer Free** | 3 channels, 10 queued/channel, API on Free |
| Launch/directories | **Product Hunt, AlternativeTo, Softpedia, FossHub** | Manual, free, long-tail discovery |
| Windows packages | **winget-pkgs + Chocolatey** | Free, automatable, trusted install paths |
| Feedback | **GitHub Issues** | Free, API, already where the code lives |
| Transactional email | **Resend Free** | 3,000/month, 100/day, 3 domains |
| Monitoring | **Better Stack Free + UptimeRobot Free** | 3-min/5-min checks, status pages, APIs |
| Automation | **GitHub Actions** | Free for public repos; already in the repo |
| Crash reporting | **None in Toolbox; Sentry Free for Bartender Aid** | Preserves Toolbox's no-telemetry promise |
| Backend | **Render Free + Neon Free** | $0 for beta; cold-start caveat |
| Short links | **Direct UTM links** | No vendor, no extra privacy surface |

**One-time / optional costs**

| Item | Cost | Required? |
|---|---|---|
| Google Play registration | **$25 one-time** | Only if shipping Android beyond local testing |
| Domain (Cloudflare Registrar) | ≈$10–15/year | Optional; needed for branded email/site |
| Apple Developer Program | **$99/year** | Only if shipping iOS |
| Code-signing certificate | ≈$200–500/year **⚠ verify** | Only if not using Microsoft Store MSIX |

**What this stack does not do:** no self-hosted analytics, no social inbox, no advanced funnels, no in-app crash reporting for Toolbox, no SLA on Render Free. That is the trade-off for $0.

---

## 17. Recommended under $30/month stack

| Layer | Choice | Monthly cost |
|---|---|---|
| Site hosting | Cloudflare Workers static assets (free tier) | $0 |
| Analytics | **Plausible Starter** (10k pageviews) | **$9** |
| Newsletter | **Buttondown Basic** (1,000 subscribers) | **$9** |
| Backend | **Render Starter** (no 15-min sleep) | **$7** |
| Database | Neon Free | $0 |
| Monitoring | Better Stack Free | $0 |
| Transactional email | Resend Free | $0 |
| Social | Buffer Free | $0 |
| Feedback | GitHub Issues | $0 |
| **Total** | | **$25/month** |

**Optional within the $30 ceiling**

- Cloudflare Workers Paid ($5/month) if the free 100k requests/day is exceeded → total $30.
- UptimeRobot Solo ($7/month) for 60-second checks → would exceed the ceiling; keep Free.
- Sentry Team ($26/month) does **not** fit. Keep Sentry Free.
- Buffer paid channels ($5–6/channel) do **not** fit. Keep Free.
- Dub Pro (~$30) does **not** fit. Use direct UTM.

**Why this is the best paid step:** it fixes the three things free tiers compromise — analytics API access (Plausible), newsletter headroom (Buttondown), and backend cold starts (Render Starter) — without buying tools the project does not yet need. Apple's $99/year and the code-signing certificate are separate annual decisions.

---

## 18. Decision table

| Category | Vendor | Readiness | Effort | Cost | Verdict | Top reason |
|---|---|---|---|---|---|---|
| Hosting | GitHub Pages | 4/5 | 1–2 h | $0 | **Adopt** | Repo-native, free, enough bandwidth |
| Hosting | Cloudflare Pages | 4/5 | 3–4 h | $0 | Optional | Scale/edge, but more setup |
| Hosting | Netlify | 5/5 | 2 h | $0 (300 credits) | Optional | Great DX, less generous free tier |
| Hosting | Vercel | 5/5 | 2 h | $0 Hobby | **Reject** | Hobby is non-commercial |
| Analytics | GoatCounter | 4/5 | 1 h | $0 | **Adopt** | Free + API + cookie-free |
| Analytics | Umami Cloud | 3/5 | 1–2 h | $0 / $20 | Optional | No API on Free; 1 site |
| Analytics | Umami self-host | 4/5 | 3–4 h | Server | Optional | Ownership, but maintenance |
| Analytics | Plausible | 5/5 | 1 h | $9 | Optional | Best paid, no free tier |
| Analytics | Cloudflare WA | 3/5 | 0.5 h | $0 | **Adopt (secondary)** | Free independent check |
| Newsletter | Buttondown | 4/5 | 1–2 h | $0 / $9 | **Adopt** | Dev-first, 100 free |
| Newsletter | MailerLite | 4/5 | 2 h | $0 / ~$10 | Optional | EU/GDPR, 250 free |
| Newsletter | Kit | 4/5 | 2 h | $0 / $39 | Optional | 10k free, no automations |
| Social | Buffer | 4/5 | 1–2 h | $0 | **Adopt** | API on Free |
| Social | Publer | 3/5 | 2 h | ~$21 for API | **Reject** | API paywall |
| Social | Postiz self-host | 4/5 | 4–6 h | Server | Optional | AGPL self-host |
| Social | Later | 2/5 | 0 h | Paid | **Reject** | No public API |
| Launch | Product Hunt | 3/5 | 3–4 h | $0 | **Adopt** | Manual launch, read API |
| Launch | AlternativeTo | 2/5 | 1 h | $0 | **Adopt** | Free manual listing |
| Launch | Softpedia | 2/5 | 1 h | $0 | **Adopt** | Free manual listing |
| Launch | FossHub | 2/5 | 1 h | $0 | Optional | Curated, not guaranteed |
| Windows | winget-pkgs | 5/5 | 2–4 h | $0 | **Adopt** | Schema + automation |
| Windows | Chocolatey | 4/5 | 3–5 h | $0 | **Adopt** | Free, moderated |
| Windows | Microsoft Store | 4/5 | 8–16 h | $0 | Optional/strategic | Free signing fixes SmartScreen |
| Mobile | Google Play | 4/5 | 4–8 h | $25 once | **Adopt** | Fastest path, internal testing |
| Mobile | App Store | 4/5 | 8–16 h | $99/yr | Optional/defer | Wait for retention |
| Feedback | GitHub Issues | 5/5 | 0.5 h | $0 | **Adopt** | Free + API |
| Crash | Sentry | 4/5 | 2–4 h | $0 / $26 | Bartender Aid only | Toolbox no-telemetry promise |
| Short links | Dub.co | 4/5 | 1 h | $0 / $30 | Optional | Free tier unverified |
| Short links | Cloudflare Worker | 3/5 | 2–3 h | $0 | Optional | Build/own redirects |
| Short links | Direct UTM | 5/5 | 0.5 h | $0 | **Adopt** | No vendor needed |
| Email | Resend | 5/5 | 1–2 h | $0 / $20 | **Adopt** | Transactional only |
| Automation | n8n self-host | 4/5 | 4–6 h | Server | Optional | GitHub Actions covers cron |
| Automation | Apify | 4/5 | 1–2 h | $5 credit | Optional | One-off scrapes |
| Monitoring | UptimeRobot | 4/5 | 0.5 h | $0 | Optional | Secondary, 5-min |
| Monitoring | Better Stack | 4/5 | 0.5 h | $0 | **Adopt** | 3-min checks + API |
| Monitoring | Uptime Kuma | 3/5 | 2–3 h | Server | Optional | Self-host, limited API |

---

## 19. First 5 integrations to build

These are ordered by launch impact. Each includes the exact doc, auth model, and acceptance criteria.

### 1. Deploy the landing page to GitHub Pages

- **Docs:** [Configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), [HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).
- **Auth:** GitHub Actions `GITHUB_TOKEN`; repository settings for Pages.
- **Steps:** add a `pages` job to Actions; publish `website/`; set custom domain if available; enforce HTTPS.
- **Acceptance:** `https://<domain>/` serves the landing page; `http://` redirects to `https://`; the download button resolves to the latest GitHub Release; mobile 360 px layout works.
- **Effort:** 1–2 hours.

### 2. Add GoatCounter and a UTM convention

- **Docs:** [GoatCounter API](https://goatcounter.com/help/api), [GoatCounter start](https://www.goatcounter.com/help/start).
- **Auth:** per-site API token for reads; the tracking script needs no auth.
- **Steps:** create one site for the landing page; add the script to `index.html`; define `utm_source/medium/campaign/content`; create a link sheet for launch channels.
- **Acceptance:** visits appear in GoatCounter within minutes; UTM-tagged links show the correct source/campaign; no cookies are set by the analytics script.
- **Effort:** 1 hour.

### 3. Wire the newsletter form to Buttondown

- **Docs:** [Buttondown API introduction](https://docs.buttondown.com/api-introduction).
- **Auth:** Buttondown API key; keep it server-side or use the hosted form endpoint, never in client JS.
- **Steps:** create the list; embed the form or post to `https://api.buttondown.email/v1/subscribers`; enable double opt-in; add consent text and a privacy-policy link.
- **Acceptance:** a test signup receives the confirmation email; the subscriber appears with source/consent metadata; unsubscribe works; export works.
- **Effort:** 1–2 hours. **Verify free-plan API access before building.**

### 4. Automate the winget manifest

- **Docs:** [winget repository submission](https://learn.microsoft.com/en-us/windows/package-manager/package/repository), [wingetcreate](https://github.com/microsoft/winget-create).
- **Auth:** GitHub token with fork/PR permissions.
- **Steps:** generate the manifest from the GitHub Release URL; compute SHA256; validate with `winget validate`; submit a PR to `microsoft/winget-pkgs`; add a release checklist item for each version.
- **Acceptance:** `winget install <PackageId>` installs the current version on a clean Windows VM; the manifest PR passes validation; the next release updates the manifest with one command.
- **Effort:** 2–4 hours first package, ~30 minutes per release afterward.

### 5. Create Better Stack monitors and a status page

- **Docs:** [Better Stack Uptime API](https://betterstack.com/docs/uptime/api/).
- **Auth:** Better Stack API token.
- **Steps:** monitor the landing page (3 min), the latest GitHub Release asset URL (5 min), and `https://<bartender-api>/api/health` (3 min); create a public status page; add email alerts.
- **Acceptance:** a forced failure alerts within 5 minutes; the status page shows the three components; the health monitor keeps Render warm.
- **Effort:** 30–60 minutes.

**Next after these five:** Buffer API for scheduled launch posts, GitHub Issue templates/stale workflow (already in progress), and Resend domain verification for transactional email.

---

## 20. Risks, unverified items, and owner decisions

### 20.1 Unverified or time-sensitive items

| Item | Why it matters | Action |
|---|---|---|
| Buttondown API on Free | The pricing page does not state API access | Confirm in the account/docs before wiring the form |
| Publer API plan gating | Third-party claim that API needs Business (~$21/mo) | Check the plans page at signup; if true, reject for zero-cost |
| Dub free tier | Current pricing page emphasizes Business/Advanced; free tier is reported by third parties | Verify before relying on it; otherwise use direct UTM |
| UptimeRobot commercial terms | Sources conflict on personal/non-commercial restriction | Read the current terms; Better Stack is the primary anyway |
| Google Play 12 testers / 14 days | Rule applies to personal accounts created after 2023-11-13; numbers have changed before | Confirm in Play Console before planning the production date |
| MailerLite free limits | Reduced from 1,000/12,000 to 250/2,500 | Do not plan around older figures |
| Netlify credit consumption | 300 credits; bandwidth 20 credits/GB; builds also consume credits | Estimate with the current pricing page, not legacy docs |
| Code-signing certificate pricing | OV/EV prices vary by CA and validation | Get two quotes if the Store path is deferred |
| Microsoft Store acceptance | MSIX packaging and certification can fail or take time | Test the package before announcing a Store date |

### 20.2 Owner decisions

| Decision | Default recommendation | Why | Blocks launch? |
|---|---|---|---|
| **Domain** | Buy one via Cloudflare Registrar (~$10–15/yr) | Needed for branded email, Resend, canonical URL | No, but strongly recommended |
| **Newsletter vendor** | Buttondown Free; switch to Kit or MailerLite at 90 subscribers | Best API/effort fit; keeps data exportable | Yes, for the signup form |
| **Analytics** | GoatCounter + Cloudflare WA | Free, API, cookie-free | No; can add after launch |
| **Crash reporting** | No in-app telemetry in Toolbox; Sentry Free for Bartender Aid only | Preserves the "no telemetry" promise | No; policy decision |
| **SmartScreen/signing** | Evaluate Microsoft Store MSIX (free Store signing) before buying a certificate | Unsigned installers suppress conversions | Yes, for download conversion |
| **Mobile sequencing** | Android internal testing now; iOS after 30-day retention | $25 vs $99/yr and different review risk | No; can start Android only |
| **Social scheduler** | Buffer Free | API on Free, 3 channels, enough queue | No |
| **Backend hosting** | Render Starter ($7/mo) before public launch | Avoids 15-minute cold starts on mobile | No, but affects first-run UX |
| **Product Hunt date** | After site, download, and first-run are stable | Launch is one-shot; don't burn it early | Yes, for the launch plan |
| **Budget tier** | Approve $0 now; pre-approve $25/mo if growth justifies it | Removes repeated approval cycles | No; decision needed before paid upgrades |

### 20.3 Risks

- **SmartScreen is the largest conversion risk.** An unsigned installer warns users away. Store MSIX signing is free but requires packaging; a certificate costs money. Decide before driving traffic.
- **Product Hunt is one-shot.** Do not launch until the site, download, installer, and first-run experience are ready. A failed launch is hard to repeat.
- **Store and directory reviews add latency.** Softpedia (~14 days), Chocolatey moderation, Microsoft certification, and Google Play's 14-day closed test can each delay a date. Sequence them early.
- **Adding analytics to Toolbox would break a public promise.** Keep web analytics on the site; do not add in-app telemetry without an explicit, opt-in policy change.
- **GDPR is not just a banner.** Newsletter consent, DPA/SCCs, data subject rights, retention, and privacy-policy accuracy all apply. The chosen analytics tools are cookie-free, which simplifies but does not eliminate the obligation.
- **Free tiers change.** MailerLite already reduced its free plan; Netlify moved to credits; Dub's free tier is unclear. Re-verify at signup and keep export paths.
- **Render Free cold starts hurt mobile first-run.** A 3-minute monitor mitigates but does not eliminate the issue. $7/month fixes it.
- **Directory traffic is usually small.** Product Hunt and HN/Reddit drive spikes; AlternativeTo/Softpedia/FossHub are long-tail SEO. Do not over-invest in directory automation.

---

## Appendix A: Sources

### Static hosting

- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/workers/static-assets/
- https://www.cloudflare.com/plans/developer-platform/
- https://www.netlify.com/pricing/
- https://vercel.com/docs/plans/hobby
- https://vercel.com/pricing

### Analytics

- https://www.goatcounter.com/
- https://goatcounter.com/help/api
- https://umami.is/pricing
- https://docs.umami.is/docs/api
- https://github.com/umami-software/umami
- https://plausible.io/docs/subscription-plans
- https://plausible.io/docs/stats-api
- https://www.cloudflare.com/web-analytics/
- https://developers.cloudflare.com/analytics/graphql-api/

### Newsletter

- https://buttondown.com/pricing
- https://docs.buttondown.com/api-introduction
- https://www.mailerlite.com/free-plan
- https://www.mailerlite.com/pricing
- https://developers.mailerlite.com/docs
- https://kit.com/pricing
- https://developers.kit.com/v4

### Social scheduling

- https://buffer.com/api
- https://developers.buffer.com/
- https://buffer.com/pricing
- https://publer.com/plans
- https://publer.com/docs
- https://postiz.com/pricing
- https://github.com/gitroomhq/postiz-app
- https://docs.postiz.com/
- https://www.outstand.so/blog/later-alternatives

### Launch and directories

- https://www.producthunt.com/launch
- https://www.producthunt.com/launch/preparing-for-launch
- https://api.producthunt.com/v2/docs
- https://api.producthunt.com/v2/docs/rate_limits/headers
- https://alternativeto.net/faq/
- https://win.softpedia.com/contact_submit.shtml
- https://www.softpedia.com/user/terms.shtml
- https://www.fosshub.com/signup.html

### Windows distribution

- https://learn.microsoft.com/en-us/windows/package-manager/package/repository
- https://github.com/microsoft/winget-create
- https://docs.chocolatey.org/en-us/community-repository/moderation/
- https://docs.chocolatey.org/en-us/create/create-packages/
- https://learn.microsoft.com/en-us/windows/apps/publish/whats-new-individual-developer
- https://blogs.windows.com/windowsdeveloper/2026/05/07/publish-to-microsoft-store-as-a-company-now-with-free-registration-and-faster-onboarding/
- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
- https://learn.microsoft.com/en-us/windows/msix/package/sign-msix-package-guide
- https://learn.microsoft.com/en-us/windows/apps/publish/store-submission-api

### Mobile distribution

- https://support.google.com/googleplay/android-developer/answer/14151465?hl=en
- https://support.google.com/googleplay/android-developer/answer/9845334?hl=en
- https://support.google.com/googleplay/android-developer/answer/6112435?hl=en
- https://developer.android.com/blog/posts/android-developer-verification-rolling-out-to-all-developers-on-play-console-and-android-developer-console
- https://primetestlab.com/blog/google-play-changed-20-to-12-testers
- https://developer.apple.com/programs/
- https://developer.apple.com/programs/whats-included/
- https://developer.apple.com/documentation/appstoreconnectapi

### Feedback and crash

- https://docs.github.com/en/rest/issues/issues
- https://sentry.io/pricing/
- https://docs.sentry.io/api/
- https://docs.sentry.io/platforms/javascript/guides/electron/data-management/data-collected/

### Short links and email

- https://dub.co/pricing
- https://dub.co/docs/api-reference/introduction
- https://github.com/dubinc/dub
- https://developers.cloudflare.com/workers/
- https://resend.com/pricing
- https://resend.com/docs/api-reference

### Automation and monitoring

- https://docs.n8n.io/n8n-community-license
- https://docs.n8n.io/api/
- https://apify.com/pricing
- https://docs.apify.com/api/v2
- https://help.uptimerobot.com/en/articles/11604710-who-should-use-uptimerobot-s-free-plan
- https://uptimerobot.com/api/
- https://betterstack.com/uptime
- https://betterstack.com/docs/uptime/api/
- https://github.com/louislam/uptime-kuma
- https://github.com/louislam/uptime-kuma/wiki/API-Documentation

### Adjacent stack

- https://render.com/docs/free
- https://render.com/pricing
- https://neon.com/pricing
- https://neon.com/docs/introduction/plans
- https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions
- https://docs.github.com/en/rest/releases/releases
- https://www.cloudflare.com/domains/

---

## Appendix B: Scoring assumptions

- Readiness maps to the 48-check framework: **5** = 85–100 with no critical failures, **4** = 70–84 with no critical failures, **3** = 50–69, **2** = 30–49, **1** = below 30. A vendor with no public API cannot exceed 2, even if its manual process is excellent.
- Effort estimates are for one developer familiar with the stack, including setup and a first successful end-to-end test. They exclude ongoing moderation, content creation, and support.
- Costs are in USD and monthly unless stated. Annual store fees and one-time registration fees are called out separately.
- No live API calls were made to vendor services. Scores are based on public documentation, pricing pages, and documented limits. A vendor can score lower in practice if its docs are stale or its free tier is withdrawn.
- "Lock-in" measures how hard it is to leave with data and configuration intact. Static files and standard protocols are low; proprietary automation/forms and app-store identities are higher.
- GDPR notes are engineering guidance, not legal advice. Use a DPA, document consent, and review the privacy policy with counsel if the project starts processing personal data at scale.
