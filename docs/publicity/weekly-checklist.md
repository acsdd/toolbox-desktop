# Weekly publicity checklist

Opened automatically every Monday by `.github/workflows/weekly-publicity.yml`.
One open issue at a time; close it at the end of the week.

## Pre-public gate (skip until all are true)

- [ ] Private-repo audit passed (no secrets or local paths in history).
- [ ] Repository is public.
- [ ] `origin` remote is configured and `main` is pushed.
- [ ] Pages source is **GitHub Actions** and the Website workflow has run.
- [ ] Canonical URL and download links resolve for a logged-out visitor.
- [ ] A release with downloadable assets is published.
- [ ] Analytics decision recorded; beacon token available before any copy change.

## This week

- [ ] Review the content calendar in `docs/publicity/advertising-solutions.md`.
- [ ] Pick one primary channel for the week; do not spread across five.
- [ ] Publish only approved drafts; every link carries UTM parameters.
- [ ] Reply to genuine community threads; never drop a link without context.
- [ ] Record the KPI snapshot: stars, release downloads, site visits, installer conversion.
- [ ] Note one thing that worked and one that did not.
- [ ] Update the top-7 priority list if the evidence changed.

## Guardrails

- No paid promotion, account creation or store submission without owner approval.
- No analytics script or privacy-copy change without a beacon token.
- No automatic posting to social channels.
- Security and roadmap issues stay open; the stale bot exempts them.

## References

- `docs/publicity/advertising-solutions.md` — channels, calendar, KPIs.
- `docs/publicity/automation-plan.md` — automation architecture and rhythm.
- `docs/publicity/vendor-assessment.md` — approved zero-cost stack.
- `docs/publicity/signing-options.md` — SmartScreen plan.
