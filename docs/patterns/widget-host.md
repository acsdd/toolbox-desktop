# Widget host — shared layout convention

Reference implementation: **toolbox-desktop** (`src/renderer/src/App.tsx`,
`src/renderer/src/styles.css` "Widget host" section). Portable CSS copy:
[`widget-host.css`](./widget-host.css). Verified screenshots:
`.screenshots/01h2-player-rail.png` (Mode B), `01h3-host-notes.png` and
`01h4-host-crypto.png` (Mode A), `01h5-player-full-again.png` (host → full).

The canonical portable copy now ships from the shared core as
`WIDGET_HOST_CSS` (`@toolbox/widgets`, `src/layout/widget-host.ts`), because the
widgets build is `tsc`-only and cannot copy `.css` files. **toolbox-nas** and
**toolbox-mcp** inject that constant and adopt the glued stage + right rail;
desktop remains the reference. This convention doc stays private; only the
generic, secret-free CSS string lives in the public widgets repo.

## The idea

Widgets are **glued building blocks**. A widget host is three blocks side by
side, reusing each widget's *existing* component unchanged:

```
[ widget screen ] [ vertical tool rail ] [ player ]
```

The only thing that changes versus a standalone widget is the surrounding
layout and the toolbar orientation (horizontal → vertical). Do **not** rebuild
widget screens for the host; render the registered component as-is.

## Hard invariant

**The full player and the mini player are never on screen at the same time.**
Exactly one is visible. Enforce this in application state (a single boolean /
mode), never by hoping CSS hides one. Opening the full player closes the mini
player; closing the mini player reveals the full player.

## Modes

| Mode          | Layout                              | When                                    |
| ------------- | ----------------------------------- | --------------------------------------- |
| `mode-host`   | `[ screen \| rail \| mini player ]`  | a widget is opened from the rail         |
| `mode-mini`   | `[ rail \| mini player ]`            | compact player, no widget glued          |
| `mode-full`   | `[ full player \| rail ]`            | full player opened, or mini closed       |
| `mode-normal` | `[ screen ]`                         | regular dashboard; rail + player hidden  |

In `mode-full` the rail sits on the **right** of the full player. In
`mode-host` the rail sits between the widget screen and the mini player.

## Structure rules

1. **One flex body, three stable children** in fixed DOM order:
   `content` (screen), `tool-rail` (nav), `player-page` (player). Modes change
   only CSS `order` / visibility — the player element is never moved or
   remounted, so audio and queue state survive every mode switch.
2. **The rail is the widget menu.** Same tools/icons as the horizontal toolbar;
   vertical orientation. Picking a non-player widget enters `mode-host`;
   picking the player enters `mode-full`; brand/expand returns to the dashboard.
3. **Window sizing follows the mode.** The host asks for a wider window
   (screen + rail + player); plain mini asks for a narrow one; full restores the
   normal window. Keep a single restore snapshot so transitions don't clobber
   each other, and never let the mini/host sizer fight the compact-bar sizer.
4. **Player mini state is site-driven but controllable.** Where the player is an
   embedded page (ArtistWave), enter/leave its compact mode through its host API
   (`ArtistWaveMiniHost.open()` / `closeFallback()`) so the app — not only the
   site's own button — can enforce the invariant.

## Adopting in another app

1. Import `WIDGET_HOST_CSS` from `@toolbox/widgets` and inject it into your
   page/stylesheet (or copy `widget-host.css`); map its `--wh-*` / theme
   variables to your palette. Inject it *before* your own rules so app-specific
   spacing can override the shared defaults.
2. Wrap your existing widget component, vertical rail, and player in
   `.app-body` with the mode class; keep the player mounted in place.
3. Add a mode state machine that enforces full-XOR-mini and drives window size.
4. Reuse your registered widget components unchanged inside `.host-screen`.

Apps **without a player** (NAS, MCP) still adopt the glued stage + right rail:
either `.app-body.mode-host` with `.content > .host-screen` + `.tool-rail`
(NAS), or apply `.host-screen` to an existing grid/flex stage and place the
labelled rail in the right-hand column (MCP). The full-XOR-mini invariant only
applies where a player exists.