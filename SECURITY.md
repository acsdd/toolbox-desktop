# Security policy

## Reporting a vulnerability

Use GitHub's private vulnerability reporting: open the **Security** tab of this repository and choose **Report a vulnerability**. Do not open a public issue for a suspected vulnerability.

If private reporting is unavailable, open a public issue that asks for a private channel and contains no exploit details.

Please include the affected version, Windows version, reproduction steps and the impact you expect.

## Scope

In scope:

- The Electron app in this repository, including the update checker, vault, backup, IPC bridge and embedded content handling.
- The landing page in `website/`.

Out of scope:

- Third-party services linked from the app (GitHub, Gmail/IMAP, Open-Meteo, CoinGecko, GitHub Pages).
- Builds downloaded from anywhere other than this repository's Releases page.

## Supported versions

Security fixes target the latest released `0.9.x` build. Older builds are not maintained.

There is no bug bounty program.
