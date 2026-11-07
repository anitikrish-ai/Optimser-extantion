# Architecture

## Runtime map

```
popup / dashboard (src/ui)  --SET_CONFIG, TAB_PAUSE, ...-->  background (src/background)
content script (src/content) --GET_PLAN, REPORT_SAMPLE, SAFETY_TRIP-->  background
background --PLAN_CHANGED, RESTORE_NOW, SAMPLE_NOW-->  content script
background --declarativeNetRequest-->  the browser's network stack
```

There is one runtime implementation. Four bundles are built from `src/`: `background.js`, `content.js`, `popup/popup.js`, `options/options.js`. All are classic scripts (IIFE). The earlier version listed ES modules as content scripts, which browsers cannot load.

## Modules

| Path | Role |
| --- | --- |
| `shared/types.ts`, `config.ts` | Types, defaults, deep sanitization of every incoming config |
| `shared/measure.ts` | The Measurement type (measured, estimated with method, unavailable with reason) |
| `shared/tracker-list.ts` | Single source of bundled block lists, essential hosts, rule ids and priorities |
| `safety/` | Host normalization, allowlist matching, essential paths and hosts, custom rule grammar |
| `adaptive/decide.ts` | Pure adaptive decision with documented thresholds |
| `policy/resolve.ts`, `edit.ts` | Precedence resolver and pure config edits |
| `adapters/` | Browser adapter (feature detection), network plan builder, network applier |
| `background/` | Session state, request handlers, entry |
| `content/` | Controller, shared DOM watcher, modules (images, videos, rendering, dom), sampler |
| `metrics/` | Comparison and display formatting |
| `ui/` | Popup and dashboard |

## Precedence

`resolveEffective` applies, in order: global settings, site override (longest matching hostname), adaptive level, safety. The first three decide what would run; safety decides whether anything may run, and wins. The adaptive step can only choose a level, never enable a disabled module.

The background resolves everything it can know (settings, hostname, path, master switch, allowlist, tab pause). The content script adds what only the page can know: device and page signals for the adaptive level, and sensitive elements. A page-level safety trip rolls back all changes, and the background then adds a tab-scoped network bypass.

## Network

Static rulesets (`replay`, `analytics`, `ads`, `essential`) are generated at build time from `tracker-list.ts`. User state (skip list, per-tab bypass, custom rules) is applied as **session rules**, which the browser clears at shutdown. If session rules are unavailable the adapter falls back to dynamic rules and reports that they persist until the next startup reconcile.

Priority ladder, highest first: user allow (100: skip list, built-in protected hosts, tab bypass), essential allow (10: auth, payment, CAPTCHA providers), custom block (5), bundled block (1). No user or bundled block can therefore override an essential provider, and the user can always switch blocking off per site or per tab.

Network applies are serialized through a promise chain.

## Messaging and security

* The browser only delivers messages from this extension's own contexts (no `externally_connectable`).
* `parseRequest` validates every message. `classifySender` accepts only our extension id, extension pages by URL prefix, and top-frame content scripts.
* Content scripts may send only `GET_PLAN`, `REPORT_SAMPLE`, `SAFETY_TRIP`. Anything that changes configuration or tab state requires an extension page.
* Samples from content scripts are re-validated (finite numbers, bounded strings, estimates must carry a method).
* All configuration, whatever its origin, goes through `sanitizeConfig` (bounded lists, hostnames normalized, prototype-pollution safe).
* Custom rules use a narrow grammar anchored to a hostname. They compile to declarativeNetRequest `urlFilter` values, which are not regular expressions, so there is no regex-denial-of-service path. Rules cannot target file names, IPs, bare suffixes, essential providers or page navigations.
* UI code writes text with `textContent`; no HTML is parsed from data.

## Content pipeline and self-overhead

* One shared `MutationObserver` serves all modules. Its callback only queues added elements.
* Work runs in idle time in slices of at most 8 ms, so a slice cannot become a long task.
* The queue is capped at 2000; on overflow it falls back to a single full rescan.
* The observer is disconnected while the tab is hidden, with one rescan when it becomes visible.
* After 1000 ms of cumulative own work the watcher stops (self-limited, reported in the popup).
* Measurement uses buffered observers that are read once and disconnected. There is no polling in the page, and none in the popup except a bounded poll while a user-started comparison runs.
* Time spent in the extension's callbacks is measured and displayed as "Extension time" (a lower bound; it excludes browser-internal observer delivery cost).
* These budgets are design limits, not measured guarantees. They have not been profiled in a real browser.

## Lifecycle and cleanup

Each module owns its listeners, observers and timers through `Disposer` and implements `stop()` as a full undo. Attributes the extension adds are marked, and removed on restore only if the page has not changed them since. Previous inline styles are saved and restored, and empty `style` attributes are not left behind. The controller restores on plan change, safety trip, tab pause, master switch off and page hide. Tests compare the page HTML before and after.

## State

`storage.session` (memory-backed, cleared at browser exit, survives background restarts) holds the configuration and, per open tab, hostname, bypass flag, latest sample and comparison. Records are deleted when the tab closes. If `storage.session` is missing, state stays in memory only.

## Before/after comparison

`COMPARE_START` marks the tab, adds a tab-scoped allow rule, and reloads with cache bypass. The baseline page load reports an unoptimized sample; the background re-arms blocking, reloads again, and the optimized load reports. A comparison fails cleanly if the site changes, the baseline turns out to be optimized, or the optimizer is inactive. Only metrics measured in both runs are compared.

## Build

`scripts/build.mjs` bundles with esbuild, generates static rulesets and PNG icons (Chromium rejects SVG manifest icons), writes per-browser manifests, and validates: manifest references exist, rule ids are unique, bundles contain no module syntax.
