# Browser compatibility

Status key: **tested with fakes** means unit tests run against a fake browser API. **Not tested in a real browser** means exactly that. No real-browser testing has been done yet.

## Feature support (by design, via feature detection)

| Feature | Chromium (102+) | Firefox (115+) | Safari |
| --- | --- | --- | --- |
| Background | Service worker | Event page (`background.scripts`) | Via converter, untested |
| Request blocking (declarativeNetRequest) | Supported | Supported | Support level not verified. Untested |
| Session-scoped rules | Supported | Supported | Unverified. Falls back to dynamic rules |
| Toggle bundled rulesets | Supported | Supported | Unverified |
| Tab-scoped allow rules (`tabIds`, session only) | Supported | Supported per Firefox schema | Unverified |
| Blocked-request count | `getMatchedRules` with `activeTab` (rate-limited, so the popup does not poll it). A toolbar badge count is requested through `setExtensionActionOptions` when present, unverified | Not exposed. Shows Unavailable | Not exposed. Shows Unavailable |
| `storage.session` | Supported | Supported | Unverified. Falls back to memory |
| Device memory, connection type, Data Saver | Exposed | Not exposed | Not exposed |
| Long Tasks, JS heap size | Exposed (heap is coarse) | Not exposed | Not exposed |
| LCP | Exposed | Not verified | Not verified |
| `content-visibility` | Supported | Not verified | Not verified. The module does nothing if the engine reports no support |

A feature that is not supported is disabled and reported in the dashboard; it never throws.

## Sources checked

Chromium docs: `getMatchedRules` requires `activeTab` for the tab or the feedback permission, and calls with a user gesture are exempt from its quota; session rules are cleared when the browser shuts down; the `declarativeNetRequest` permission gives implicit block and allow rules without host access. MDN and the Firefox schema: block and allow need no host permissions, `initiatorDomains` is supported, and `tabIds` is supported for session rules only.

## Mobile

* **Firefox for Android 115+** is the target. `declarativeNetRequest` and `storage.session` support on Android has not been verified on a device. The popup is fluid below 480 px and controls are at least 44 px tall on touch screens.
* **Chrome for Android** does not support extensions.
* Android install requires a signed add-on. See the README, Phones and tablets.
* On a phone, run checklist items 1 to 9 below, plus: open the popup and dashboard in portrait and landscape and confirm nothing needs sideways scrolling.

## Known compatibility issues

* **Firefox host access.** Firefox has treated host access for content scripts as something users may need to grant. If nothing happens on pages, check the extension's permissions in `about:addons`. Needs verification per Firefox version.
* **Firefox add-on id** in `manifest/firefox.json` is a placeholder.
* **Safari** needs `xcrun safari-web-extension-converter dist/chromium` and an Xcode project. Not done. Expect to re-verify rule support, session rules and `storage.session`.
* **`content-visibility`** applies containment that can clip overflowing content or change positioning of fixed descendants. The module skips obvious risks but cannot detect all of them. Disable the DOM module for a site if layout breaks.
* **Autoplay guard** pauses any video that starts before interaction, including intentional muted hero loops. Clicking a paused control-less video starts it.
* **Lazy loading** cannot cancel loads that already started.
* **Pause on this tab and Before/after reload the page.** Unsaved input is lost.
* **Sites that gate on analytics tags** may behave differently when those requests are blocked. Use Skip this site.

## Manual test checklist (not yet performed)

For each browser:

1. Load the build. Confirm no manifest errors and that the popup and dashboard open.
2. Visit a heavy news page. Confirm the popup shows OPTIMIZED, and (Chromium) a blocked-request count.
3. Open the same page with **Pause on this tab**. Confirm the page reloads without changes and trackers load.
4. Add the site to the skip list. Confirm status SKIPPED and that blocked requests stop.
5. Sign-in page with a password field: confirm status OFF and no changes. Test a checkout and a CAPTCHA page.
6. Run **Before and after** on three sites. Confirm both reloads occur and the table shows only measured rows.
7. Add a custom rule for a test host. Confirm it blocks there and cannot be added for stripe.com.
8. Master switch off: confirm all tabs revert and no requests are blocked.
9. Close a tab and the browser. Confirm settings reset on restart.
10. Profile a heavy page with the browser's performance tools with and without the extension. Record the extension's own main-thread time.
11. Inspect the service worker or event page for network activity: there must be none.
