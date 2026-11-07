# Privacy

## Model

The extension makes no network requests of its own, has no analytics, no telemetry, no backend and no remote configuration. Bundled rules ship inside the package and are never updated at runtime.

## Data inventory

| Data | Where | Lifetime |
| --- | --- | --- |
| Settings (mode, toggles, skip list, per-site settings, custom rules) | `storage.session` | Until the browser closes. Not written to disk by the extension. |
| For each open tab: hostname (not the URL or path), pause flag, latest measurements, comparison results | `storage.session` | Until the tab closes or you clear tab data. |
| Blocked-request count | Read on demand from the browser's own rule-match records | Not stored by the extension. |
| Exported settings file | A file you choose to download | Under your control. |

Never collected or stored: URLs or paths, page content, form data, request URLs, browsing history, identifiers, cookies.

## Why settings reset each session

Persisting the skip list and per-site settings would create a local record of sites you visited. The default is therefore session-only. Use **Export settings** and **Import settings** to keep your own copy.

## Limits of the guarantee

* `storage.session` is documented as memory-backed. The extension cannot control operating-system paging, crash recovery or session restore.
* Browsers show you which sites a content script can access, and the extension's popup shows the current hostname. That is local display, not collection.
* The adaptive engine reads `hardwareConcurrency`, and where available `deviceMemory`, connection type and Data Saver, to choose a level. These values stay in the page and are not stored or sent. Battery status is deliberately not read, because it is a fingerprinting surface.

## Verification

`npm test` includes a static audit that fails if source code contains `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, web storage, `storage.local`, `storage.sync`, dynamic code execution, HTML injection, URL literals, cookie or history access, and checks the manifests for the exact permission set. This audit checks this project's source only; it does not audit the browser.

Reviewers can also inspect `dist/*/background.js` and `content.js`, which are plain bundles of the same source.
