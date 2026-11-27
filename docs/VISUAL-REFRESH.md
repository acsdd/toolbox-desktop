# Family visual refresh · 27 November 2026

The Desktop visual branch adds a redesigned overview, labeled wide-screen AI/IT navigation, compact navigation at narrower widths, coherent tool cards, settings and command-bar surfaces, and the approved Desktop icon. The default Night accent is periwinkle; the Day palette uses a darker action color. All eleven existing themes and stored appearance preferences remain available.

`src/renderer/src/family-foundation.css` is the portable family foundation. `family-desktop.css` maps it to this app's existing theme roles and components. Both load after the original tool styles. App-specific tool accents and semantic status colors remain independent. Full player and Mini rails keep their existing geometry.

The canonical foundation and the nine-app adoption guide live in the parent workspace at `brand-assets/family-ui/`. Copy updates with its `sync.mjs`; `--check` detects drift. Builds do not depend on the parent directory.

Rendered screenshots and verification are available in that folder. The visual work is separate from the unfinished `codex/desktop-next-wave` functional worktree; combine those branches with care around `App.tsx`. No release, installation or version bump is included.
