# Advertising solutions — Toolbox and Bartender Aid

Goal 1, item 2. Zero-budget channel plan for two products:

- **Toolbox** — a local-first Windows toolbox (Electron, v0.9.3, MIT). Fifteen utilities in one window: notes, encrypted API vault, clipboard history, file organizer, system dashboard, encrypted backup, clock and weather, text stats, AI launchpad, Gmail announcer, GitHub notifier, RSS reader, crypto watch, ArtistWave player and Bartender Aid. No account, no cloud, no telemetry.
- **Bartender Aid** — a React Native mobile app (plus a Node backend) that suggests cocktails from the ingredients a bartender actually has.

## Executive summary

1. The repository is **private**, so nothing can be announced yet: Pages, release downloads and directory listings all need public URLs. Fix that gate first.
2. The cheapest reach is not advertising; it is **distribution surfaces**: winget, Chocolatey, AlternativeTo, Softpedia, FossHub and GitHub topics. They keep sending visitors for years.
3. One launch event (Product Hunt or Show HN, not both on the same day) plus **one genuinely useful technical article** beats ten low-effort posts.
4. Communities ban drive-by promotion. Post value first, link second, and only where the tool actually fits.
5. The unsigned installer is the biggest conversion leak. Fixing SmartScreen matters more than doubling traffic.
6. At $0, the realistic plan is six weeks of consistent, manual work — not a viral moment.
7. Track four numbers weekly: GitHub stars, release downloads, site visits, installer conversion. If a channel cannot be attributed, it does not continue.

## Positioning

| Product | One-line pitch (EN) | Romanian variant |
| --- | --- | --- |
| Toolbox | Your private Windows toolbox — fifteen local utilities in one window. No account, no cloud, no telemetry. Free and MIT. | Cutia ta de unelte pentru Windows — 15 utilitare locale într-o singură fereastră. Fără cont, fără cloud, fără telemetrie. Gratuit, MIT. |
| Bartender Aid | Pour what you have — a cocktail assistant built around the 41 ingredients already on your bar. | Fă un cocktail din ce ai la bar — asistent simplu pentru bartenderi, bazat pe ingredientele pe care le ai deja. |

Supporting proof for Toolbox: DPAPI-encrypted vault, AES-256-GCM backups, no telemetry, portable build, update checker that never installs silently. Lead with **privacy + one window**, not with a feature list.

## Channel plan

Cost is $0 unless marked. Every entry needs an owner check of current platform rules before posting.

| # | Channel | Best for | Effort | Prerequisite | Rules and risk | First action |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | GitHub repo polish + topics | Both | 3 h | Repo public | Topics only visible when public; README is the conversion page | Add topics: `windows`, `electron`, `productivity`, `local-first`, `self-hosted`, `privacy`, `toolbox`; pin screenshots |
| 2 | winget-pkgs | Toolbox | 4–6 h | Public release with a stable installer URL | Manifest review; installer URL and hash must match; updates need new PRs | Draft a manifest for the per-user installer and open a PR to `microsoft/winget-pkgs` |
| 3 | Chocolatey community repo | Toolbox | 3–5 h | Public release | Moderation; package must be maintained; paid tier not required for OSS | Write the package scripts and submit after winget is green |
| 4 | Microsoft Store (MSIX) | Toolbox | 8–16 h | Store account (fee/terms — owner decision) | Review gate; slower releases; Store-managed signing | Investigate packaging; decide separately from the $0 plan |
| 5 | Product Hunt | Toolbox first | 8 h + launch day | Live Pages site, gallery assets, maker account | One meaningful launch; staged upvotes are forbidden; comments matter | Prepare five assets (icon, three screenshots, OG image) and a 60-word tagline |
| 6 | Hacker News — Show HN | Toolbox | 2 h + monitoring | Live site or public repo | Must be a real project; marketing tone gets flagged; feedback is blunt | Draft title: `Show HN: Toolbox – 15 local-first Windows utilities in one window` |
| 7 | r/selfhosted | Toolbox | 1 h | Public repo | Strict self-promotion rules; use promo threads or answer questions | Find three threads about local-first Windows tools and answer without linking first |
| 8 | r/windows, r/software, r/SideProject | Both | 1–2 h each | Public repo | Account age/karma gates; per-sub rules; duplicate posts are removed | Read each sidebar; post a screenshot-led story, not a download dump |
| 9 | AlternativeTo | Toolbox | 1 h | Public site | Listing must be accurate; category matters for discovery | Submit as an alternative to clipboard managers, note apps and toolbox apps |
| 10 | Softpedia | Toolbox | 1 h | Public installer | Editorial review; outdated listings hurt | Submit the Windows build with description and screenshots |
| 11 | FossHub | Toolbox | 1 h | Public installer | Free-software catalogue; review | Submit; keep the version current |
| 12 | dev.to / Hashnode | Toolbox | 4 h | Live site | Technical piece, not an ad; canonical URL to the site | Write "What I learned building a local-first Electron toolbox" with real trade-offs |
| 13 | YouTube Shorts / TikTok / Reels | Both | 2 h per clip | Public build | Music licensing; hook in two seconds; no fake demos | Record three 30–45 s screen clips: vault, clipboard, Bartender Aid |
| 14 | LinkedIn | Both | 1 h | Live site | Personal-network reach, low direct conversions | Build-in-public post with one screenshot and one lesson |
| 15 | Discord / Telegram communities | Both | 1–2 h | Public repo | Ask moderators first; no drive-by links; help before promoting | Join two Windows/self-hosted communities and answer questions for a week |
| 16 | Romanian tech groups (r/programare, Facebook groups, LinkedIn RO) | Both | 1–2 h | Romanian copy | Local-language copy; group rules on promotion | Post the Romanian one-liner with a screenshot and ask for feedback |

Channels 1–3, 9–11 produce long-tail discovery. Channels 5–8 produce spikes. Channels 12–16 build credibility. Do not run all of them in one week.

## What can start before the repo is public

- Polish the README, screenshots, OG image, tagline and FAQ.
- Draft channel copy and the Product Hunt/Show HN posts.
- Create owner accounts where required (no spend, no posting).
- Prepare the winget manifest and directory descriptions.
- Define KPI baselines and UTM conventions.
- **Do not publish any link**: private Pages and private releases return 404.

## Four-week calendar (starts after go-public)

| Week | Focus | Deliverables | Success signal |
| --- | --- | --- | --- |
| 1 | Foundation | Repo public, Pages live, README/topics, winget PR, AlternativeTo + Softpedia + FossHub submissions, baseline KPI snapshot | Installer reachable; listings pending or live |
| 2 | Credibility | dev.to article, two value-first Reddit comments/posts, LinkedIn build story, two short videos | First referral visits; comments answered |
| 3 | Launch | Show HN mid-week, Product Hunt within 48 h, cross-post to the best community, three short videos | One measurable spike; no rule violations |
| 4 | Consolidate | Review KPIs, keep two best channels, cut the rest, Chocolatey or Store next step, publish an update note | Repeatable weekly rhythm, not a one-off |

If Product Hunt and Show HN compete for attention, run Show HN first and Product Hunt the following week. Do not launch on a Friday or a holiday.

## KPI table

| Metric | Source | Definition | First-month threshold |
| --- | --- | --- | --- |
| GitHub stars | GitHub API | Total stars | Set baseline week 1; growth matters more than absolute |
| Release downloads | Releases API `assets[].download_count` | Setup + portable downloads | Measure per release, not cumulative only |
| Site visits | Cloudflare Web Analytics (when activated) | Visits and top referrers | Needs the beacon token; otherwise unavailable |
| Installer conversion | Downloads ÷ visits | Rough download intent | Compare channels, not absolute |
| New issues/discussions | GitHub | Issues from non-authors | Qualitative signal of real use |
| Mobile installs | Play Console (manual) | Internal-test installs | Only after a real build exists |
| 7/30-day retention | Not instrumented | App usage return rate | **Unknown at $0**; do not claim retention wins |

Limitation to state honestly: without app telemetry, retention cannot be measured. Do not promise retention improvements.

## Budget tiers

| Tier | Items | Status |
| --- | --- | --- |
| A — strict $0 | Everything in the channel plan except paid store/cert fees; `github.io` subdomain | **Current plan** |
| B — one-time $25–40 | Domain (~$10–15/yr) + Google Play registration (~$25) | Not approved; owner decision |
| C — under $200 | Tier B + code-signing or launch assets | Not approved; see `signing-options.md` |

Apple's $99/year developer program, Chocolatey paid tiers and certificate purchases are outside the current budget and need explicit approval.

## Top 7 actions, ranked

1. **Make the repo public and the Pages site live** — without this, every other action is blocked or broken.
2. **Fix the conversion surface**: README, screenshots, topics, honest SmartScreen FAQ.
3. **Open the winget-pkgs PR** — highest long-tail discovery per hour at $0.
4. **Submit to AlternativeTo, Softpedia and FossHub** — permanent catalogue presence.
5. **Publish one strong technical article** — credibility and search traffic.
6. **Run Show HN, then two value-first community posts** — measured spikes with feedback.
7. **Launch on Product Hunt** with five prepared assets and a clear maker comment.

## Bartender Aid

The mobile app has no public build yet, so its call to action stays disabled.

- Ship an Android internal-testing build first; confirm the current Play testing requirements before planning a date (the 12-tester/14-day rule is flagged unverified in `vendor-assessment.md`).
- iOS/TestFlight later; the $99/year Apple fee is an owner decision.
- Communities: bartender and cocktail subreddits, local bar/restaurant groups, hospitality Discord/Telegram, and in-person QR cards at partner venues.
- Content angle: "what can I make with these five bottles?" — short videos perform better than feature tours.
- Do not publish a store link or enable the site CTA until the listing exists.

## Do not

- Buy reviews, upvotes, stars or engagement.
- Mass-DM creators or post the same link across many subreddits in one day.
- Launch before the repo is public or before the installer downloads for a logged-out visitor.
- Claim retention, user counts or revenue without instrumentation.
- Add analytics to the site before the privacy copy and token are handled (`analytics-activation.md`).

## References

- `docs/publicity/automation-plan.md` — weekly automation rhythm.
- `docs/publicity/vendor-assessment.md` — zero-cost stack and rejected vendors.
- `docs/publicity/signing-options.md` — SmartScreen plan.
- `docs/publicity/analytics-activation.md` — deferred analytics.
- `docs/publicity/weekly-checklist.md` — the recurring operating checklist.
