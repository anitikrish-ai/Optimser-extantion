# Universal Website Performance Optimizer

A browser extension that reduces avoidable resource use on websites. It runs entirely inside your browser: no telemetry, no backend, no remote rule lists, and settings that last only for the browser session.

**Status: needs browser testing.** The logic is covered by automated tests that run in Node (see [Testing](#testing)), but the extension has not yet been loaded into real Chromium, Firefox or Safari builds, and no performance benchmarks have been run. See [Remaining limitations](#limitations) and `docs/BROWSER-COMPATIBILITY.md`.

## What it actually does

| Area | Mechanism | Limits |
| --- | --- | --- |
| Network | The browser blocks requests to bundled lists of session-replay, analytics and ad hosts (declarativeNetRequest) plus your own host-anchored rules. | The extension never sees request contents. Blocked requests never download, so their size is unknowable and no "data saved" number is shown. |
| Images | Adds `loading="lazy"` to images below the first screen that have not started loading, and `decoding="async"`. | Cannot cancel a request that has already started, so the effect depends on the page. No images are replaced or re-downloaded. |
| Videos | Pauses videos that start before any interaction, pauses muted videos that scroll out of view or sit in a background tab, and resumes only what it paused. | Audible video and Picture-in-Picture are never paused. |
| Rendering | Pauses endless CSS animations while off-screen. At the Extreme level only, removes `backdrop-filter`. | Removing blur can reduce legibility of translucent overlays. |
| DOM | Applies `content-visibility: auto` to large sections well below the fold. | Skips sections with forms, navigation, dialogs, frames or fixed positioning. Containment can clip overflowing content on some sites. |
| CPU and memory | No separate switch. Effects come from the items above (fewer scripts, fewer decoded images, paused media and animations). The extension also keeps its own work small (see below). | The extension cannot throttle a page's timers or free its memory, and does not pretend to. |

Features of the earlier version that were removed because they could not work from a content script: timer throttling, scroll throttling, canvas pausing, a `sendBeacon` patch, a script-removal observer, resource-timing buffer clearing, and battery-based decisions.

## Modes and precedence

Modes: **Adaptive**, **Balanced**, **Performance**, **Extreme**.

Precedence, applied in one function (`src/policy/resolve.ts`): global settings, then per-site settings, then the adaptive engine, then safety. Safety is applied last and always wins.

Safety always disables optimization for: the master switch being off, non-http(s) pages, sign-in, payment, CAPTCHA and local development hosts, your skip list, sign-in or checkout paths, tabs you paused, and pages where a password field, card field, CAPTCHA frame or payment frame appears.

The adaptive engine only chooses an intensity level. It never turns on a module you disabled, never lowers a level within a page, and ignores any signal the browser does not expose. Its thresholds are heuristics, listed with their rationale in `src/adaptive/decide.ts` and shown in the dashboard.

## Recovering a broken site

1. Popup, **Pause on this tab**: removes all page changes, stops blocking for that tab and reloads it. Unsaved input is lost by the reload.
2. Popup, **Skip this site**: never optimizes the site or blocks requests initiated by it.
3. Popup master switch: turns everything off in every tab and disables all bundled rulesets.
4. Dashboard, **Reset everything**.

Every change the page-side code makes is undone by a single restore step, which the tests check by comparing the page HTML before and after.

## Measurements

Every number is labelled **Measured**, **Estimated** or **Unavailable**.

* Measured: read from a browser API (timing, request counts, DOM size, long tasks and heap where exposed, rule matches where exposed).
* Estimated: would carry a stated method. The extension currently ships no estimates.
* Unavailable: the browser does not expose it (for example heap size outside Chromium).

**Before and after** reloads the page twice, first without and then with the optimizer, and shows only metrics measured in both runs, as plain differences. It uses single runs, so network conditions, cache state and changing page content affect the result. Treat small differences as noise.

Transferred bytes are a lower bound: browsers hide the size of cross-origin resources unless the server opts in.

The 60 to 70 percent figure is a design target for avoidable overhead on suitable heavy pages. It is not a measured result and not a promise for any page.

## Privacy

See `docs/PRIVACY.md`. In short: no network code, no persistent storage, hostnames kept only for open tabs, all state cleared when the browser closes.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Session storage for settings and per-tab data. Cleared when the browser closes. |
| `declarativeNetRequest` | Lets the browser block listed requests without the extension seeing them. Needs no host access for block and allow rules. |
| `activeTab` | Lets the popup read the blocked-request count for the tab it was opened on (Chromium). |
| Content script on `http://*/*` and `https://*/*` | Applies page-level optimizations in the top frame. This is the one broad access the extension needs; browsers will show it as access to your data on all websites. |

No `host_permissions`, `tabs`, `webRequest`, `cookies`, `history` or `scripting`.

## Installation

Requires Node 20 or newer for building.

```
npm install
npm run build
```

* Chromium (Chrome, Edge, Brave): open `chrome://extensions`, enable Developer mode, **Load unpacked**, choose `dist/chromium`.
* Firefox 115 or newer: open `about:debugging`, **This Firefox**, **Load Temporary Add-on**, choose `dist/firefox/manifest.json`. Replace the placeholder add-on id in `manifest/firefox.json` before publishing.
* Safari: not built or tested. See `docs/BROWSER-COMPATIBILITY.md`.

## Development

```
npm run typecheck   # tsc --noEmit, strict
npm test            # bundles tests with esbuild and runs them with node --test
npm run build       # bundles dist/chromium and dist/firefox and validates the output
npm run check       # all of the above
```

Sources are TypeScript in `src/`. `src/shared/tracker-list.ts` is the single source of the bundled rules; the build compiles it to static rulesets. Dev dependencies: `typescript`, `esbuild`, `jsdom` (tests only), `@types/node`. There are no runtime dependencies.

## Testing

`npm test` runs unit and DOM tests (Node and jsdom, with a fake browser API). It covers allowlist matching, essential-path and essential-host protection, custom rule validation, configuration sanitization, precedence, adaptive decisions, network rule planning and application, adapter feature detection, message authorization, metrics truthfulness, comparison logic, session-only storage, tab-close cleanup, emergency recovery, restore-to-identical-HTML for every module, observer release, and static audits of privacy, permissions and UI consistency.

What this does not cover: real browsers, real network blocking, real rendering and layout, other tabs and windows, and performance. See `docs/BROWSER-COMPATIBILITY.md` for the manual test checklist.

## Limitations

* Not yet run in any real browser.
* Image and iframe loading cannot be cancelled once started.
* Page timers, scroll handlers and memory cannot be controlled from an extension without patching page code, which this project does not do.
* Firefox and Safari do not expose several measurements (heap size, long tasks, blocked-request counts, device memory, connection type). They show as Unavailable.
* Settings reset each browser session by design. Use export and import to keep a copy.
* Custom rules block by host, optionally with a path. They cannot match arbitrary substrings or regular expressions, on purpose.

## Contributing

See `CONTRIBUTING.md`.

## License

MIT. See `LICENSE`.
