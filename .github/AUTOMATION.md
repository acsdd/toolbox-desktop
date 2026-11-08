# Project management automation

What runs by itself, what still needs a human, and the coverage number.

## Automated

| Recurring step | Automation | Trigger | Notes |
| --- | --- | --- | --- |
| Issue intake and required fields | `.github/ISSUE_TEMPLATE/*` | New issue | Bug reports require version, Windows build and steps; blank issues are disabled |
| PR description quality | `.github/PULL_REQUEST_TEMPLATE.md` | New PR | Summary, test plan, screenshots |
| Typecheck and build verification | `.github/workflows/ci.yml` | PR and push to `main` | Node 22, npm cache, concurrency cancel-in-progress |
| Landing page link and version integrity | `.github/workflows/ci.yml` | PR and push to `main` | `check-site-links.cjs`, `inject-site-version.cjs --check` |
| Release note drafting | `scripts/release-notes.cjs` | `v*` tag | Conventional prefixes plus changed paths; first-release fallback |
| Release build and publish | `.github/workflows/release.yml` | `v*` tag | `fetch-depth: 0`, notes file with `--generate-notes` fallback |
| Weekly publicity checklist | `.github/workflows/weekly-publicity.yml` | Monday 07:00 + dispatch | Idempotent: one open `publicity-weekly` issue |
| Stale issue cleanup | `.github/workflows/stale.yml` | Monday 06:00 | 45 days stale, 14 days to close; pinned/security/roadmap/publicity-weekly exempt |
| Pages build and deploy | `.github/workflows/pages.yml` | Manual until the repo is public | Version sync and link check run before upload |
| Version label sync | `scripts/inject-site-version.cjs` | Pages workflow / manual | Reads `package.json`; `--check` fails CI on drift |

## Manual by design

| Recurring step | Why it stays manual |
| --- | --- |
| Issue triage, labels and assignment | Needs judgment and product context |
| Final copy approval | Public claims must be reviewed before launch |
| Community replies | Automation would read as spam |
| Store console uploads | Requires owner credentials and review decisions |
| KPI interpretation and channel cuts | Strategy decision, not a cron job |
| Spend and account creation | Owner approval required; $0 policy |
| Signing and analytics activation | External applications and tokens |

## Coverage

Fourteen recurring PM steps are counted across intake, verification, site integrity, release, community and review:

- **Automated (10):** issue intake templates, PR template, typecheck/build CI, site link check, site version check, release-note drafting, release build/publish, weekly checklist issue, stale cleanup, Pages deploy.
- **Manual by design (4):** triage and assignment; final copy approval and community replies; store console uploads; KPI interpretation and channel decisions.

Coverage: **10 of 14 = 71%**, above the 70% target without automating public posting or spending decisions.

## Secrets

- `GITHUB_TOKEN` — built in; `contents: write` for releases, `issues: write` for the weekly checklist.
- `APIFY_TOKEN` — optional, future listening digest only. Never commit it; store it as an Actions secret and in the local vault.

## Failure modes

- **Release notes empty or script fails:** the release workflow falls back to `--generate-notes`.
- **Weekly issue already open:** the workflow exits without creating a duplicate.
- **Stale bot too aggressive:** exemptions cover pinned, security, roadmap and the weekly checklist.
- **Pages workflow on a private repo:** it will fail until the repository is public and Pages is enabled. The trigger stays manual until then.
- **CI on unreviewed work:** CI reflects pushed code; keep unrelated work out of publicity commits.

## Local commands

```bash
npm run site:version
npm run site:links
npm run release:notes -- --to HEAD --out dist/notes.md
```
