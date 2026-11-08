# Code signing options at $0

Status: **unsigned builds**. No usable certificate was found locally; SmartScreen will warn until a signing route is accepted.

## Local certificate scan (read-only)

Drive D: and the Windows certificate stores were checked:

- No `.pfx`, `.p12`, `.pvk`, `.spc`, `.jks`, `.keystore` or `.p7b` files.
- Certificate-shaped files found in a local scratch/download folder (paths intentionally omitted) are not Authenticode-capable:
  - A Fortinet SAML/IdP signing certificate, no Extended Key Usage.
  - A Let's Encrypt TLS server certificate, `serverAuth` only.
  - A Synology self-signed TLS certificate, `serverAuth` + `clientAuth`.
  - A Fortinet self-signed TLS certificate.
- Personal stores (`certutil -user -store My`, `certutil -store My`) contain only Let's Encrypt TLS, `localhost` development certificates, haproxy-default and IIS Express. **No Code Signing EKU.**

Conclusion: nothing on D: can sign Windows installers. A self-signed certificate only helps local testing and does not remove warnings for other users.

## Options, in recommendation order

| Option | Cost | Effort | Needs public repo | SmartScreen effect | Notes |
| --- | --- | --- | --- | --- | --- |
| SignPath Foundation | $0 for OSI-licensed OSS | Application + CI integration, days to weeks | Yes | Builds are signed; reputation still accrues | MIT qualifies; approval is not guaranteed; designed for open-source projects |
| Certum Open Source Code Signing | Free/discounted for OSS (verify) | Identity verification + application | Likely yes | Signed builds; reputation accrues | May require a hardware token or shipping fee — owner decision |
| Microsoft Store MSIX | Free registration claimed; verify current fee | 8–16 h packaging + review | No | Store installs avoid the SmartScreen prompt | Store-managed signing; slower release cadence; review gate |
| Azure Trusted Signing | ~$9.99/month | Low, CI-friendly | No | Signed builds | Violates the strict $0 rule; keep as fallback |
| Self-signed certificate | $0 | Minutes | No | None for other users | Local testing only |

Prices and program terms change; treat every figure as unverified until the provider's current page is checked during application.

## Recommendation

1. **Apply to SignPath Foundation** as soon as the repository is public. MIT license and a public repo are the main eligibility signals. Do not promise approval.
2. **In parallel, price Microsoft Store MSIX.** It is the only route that removes the warning without waiting for a certificate authority, and it can be prepared while the repo is private.
3. **Keep builds unsigned until one route is accepted.** Keep the FAQ honest: "not code-signed yet; a free OSS signing application is in progress" only after the application is actually submitted.
4. Do not buy a certificate under the current $0 policy without an explicit owner decision.

## SignPath integration sketch (after acceptance)

- Add the SignPath GitHub App and request a signing policy for the release workflow.
- Store `SIGNPATH_API_TOKEN` and the organization/project/policy slugs as Actions secrets.
- Sign the installer and portable executable after `electron-builder` and before `gh release create`.
- Keep unsigned artifacts out of public releases once signing is active.
- Verify the signature locally with `signtool verify /pa /v <file>` (Windows SDK) or `Get-AuthenticodeSignature`.

## Reputation note

A new OV certificate does not guarantee an immediate clean SmartScreen result; reputation builds with download volume. EV certificates historically carry stronger initial reputation but cost more. The Store route avoids the prompt for Store-installed copies.

## Next steps

- [ ] Owner decides SignPath vs. Store (or both).
- [ ] Make the repository public (prerequisite for SignPath).
- [ ] Submit the application and record the submission date.
- [ ] Update the release workflow only after approval.
- [ ] Update the FAQ wording once a route is accepted, not before.
