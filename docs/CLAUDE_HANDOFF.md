# Claude Engineering Handoff Guide

## Universal Website Performance Optimizer

This handoff document is tailored for Claude (or subsequent senior engineers) to rapidly understand, audit, refine, and extend the **Universal Website Performance Optimizer** extension codebase.

---

## 1. Project Philosophy & Invariants

1. **Strict Local-First Privacy**:
   - Zero network transmission outside the browser.
   - Zero telemetry, analytics, tracking, or remote config.
   - Zero persistent browsing state; only temporary in-memory or `chrome.storage.session` state.
   - State for each tab must be purged when `tabs.onRemoved` fires.
   - Dynamic DNR rules are cleared on startup and reset so they never persist across browser restarts.
2. **Safety Over Scores**:
   - Never break authentication, payment flows, forms, or interactive navigation.
   - Never blindly remove DOM elements.
   - Injected CSS must never alter font sizing, line heights, contrast, or break layouts.
   - Balanced mode must remain conservative: no blanket filter/blur stripping.
3. **Truthful Telemetry**:
   - Never fabricate savings metrics.
   - Clearly label estimated metrics vs. native hardware measurements.
   - If an API (`performance.memory`, `deviceMemory`, `connection`) is restricted or unexposed (e.g. Firefox/Safari), display "Restricted by browser API" or "Unavailable" instead of estimating fake numbers.
4. **UI Design Hard Rules**:
   - No purple, no gradients, no pill buttons, no emojis in UI.
   - Translucent dark Liquid Glass aesthetic with emerald green accents (`#10b981`).
   - Accessible keyboard navigation and contrast ratios.

---

## 2. Single Source of Truth Architecture

All core logic resides inside `src/` and is written as modular, standard JavaScript ES modules with TypeScript definitions (`src/shared/types.ts` and `tsconfig.json`).

- **Background Service Worker**: [`entrypoints/background.js`](../entrypoints/background.js) is declared with `"type": "module"` in `manifest.json`. It imports directly from `src/` and orchestrates DNR rules, session tracking, and tab broadcasting.
- **Content Scripts**: [`entrypoints/content.js`](../entrypoints/content.js) and the `src/` modules are declared sequentially in `manifest.json`. Each module attaches to `globalThis.UWPO`, and `content.js` initializes `UWPO.optimizerCore`.
- **Popup & Options**: Both [`entrypoints/popup/index.html`](../entrypoints/popup/index.html) and [`entrypoints/options/index.html`](../entrypoints/options/index.html) load their scripts with `type="module"`, allowing direct ESM imports from `src/`.

---

## 3. Recommended Order of Inspection

When reviewing or extending this codebase, review the files in this sequence:

### Tier 1: Core Orchestration & Safety
1. [`src/core/optimizer-core.js`](../src/core/optimizer-core.js):
   - The central pipeline that initializes modules, verifies safety, and manages the lifecycle.
2. [`src/safety/safety-manager.js`](../src/safety/safety-manager.js):
   - Strict domain normalization, allowlist matching, essential flow regexes (`/login`, `/checkout`, `/auth`), sensitive inputs (`input[type="password"]`, `autocomplete="cc-number"`), and essential script immunity.
3. [`src/safety/emergency-switch.js`](../src/safety/emergency-switch.js):
   - Teardown registry that removes injected CSS, disarms observers, and unpauses controlled videos.

### Tier 2: The 8 Optimization Engines
4. [`src/modules/rendering/rendering-optimizer.js`](../src/modules/rendering/rendering-optimizer.js):
   - Conservative animation capping for decorative classes in Balanced mode, with aggressive filter/blur disabling strictly gated behind Performance/Extreme modes.
5. [`src/modules/scripts/script-blocker.js`](../src/modules/scripts/script-blocker.js):
   - Injected script tag inspector targeting bloatware while protecting essential providers.
6. [`src/modules/images/image-optimizer.js`](../src/modules/images/image-optimizer.js):
   - Native lazy loading enforcement on below-fold images and asynchronous decoding.
7. [`src/modules/videos/video-optimizer.js`](../src/modules/videos/video-optimizer.js):
   - Autoplay suppression, `IntersectionObserver` off-screen video pausing, and background tab pausing.
8. [`src/modules/cpu/cpu-optimizer.js`](../src/modules/cpu/cpu-optimizer.js):
   - Visibility-aware activity minimization and off-screen canvas observation.
9. [`src/modules/dom/dom-optimizer.js`](../src/modules/dom/dom-optimizer.js):
   - Conservative `content-visibility: auto` on below-fold non-interactive content sections.
10. [`src/modules/memory/memory-optimizer.js`](../src/modules/memory/memory-optimizer.js):
    - WeakSet element tagging, observer registry, and unload teardown.
11. [`src/modules/network/network-optimizer.js`](../src/modules/network/network-optimizer.js):
    - W3C Resource Timing transfer calculation and honest bandwidth savings tracking.

### Tier 3: Adaptive Hardware Engine
12. [`src/adaptive-engine/profile-evaluator.js`](../src/adaptive-engine/profile-evaluator.js):
    - Concrete thresholds for `Balanced`, `Performance`, and `Extreme Lite` mode mapping.
13. [`src/device-detection/device-detector.js`](../src/device-detection/device-detector.js):
    - Local hardware probing (`hardwareConcurrency`, `deviceMemory`, `connection`, `battery`).
14. [`src/device-detection/workload-analyzer.js`](../src/device-detection/workload-analyzer.js):
    - DOM complexity and `PerformanceObserver` `longtask` tracking.

### Tier 4: Background Service Worker & Rules
15. [`entrypoints/background.js`](../entrypoints/background.js):
    - DNR rule orchestration, broadcast messaging to all active tabs, and session state lifetime management.
16. [`rules/default-rules.json`](../rules/default-rules.json):
    - Declarative Net Request ruleset blocking known bloatware with highest-priority allow rules for identity/payment gateways.
17. [`src/browser-adapters/net-request-adapter.js`](../src/browser-adapters/net-request-adapter.js):
    - Dynamic DNR engine handling domain allowlist exemptions, user custom block rules, and session-only rule purging.

---

## 4. High-Value Refinement & Expansion Opportunities

1. **Dynamic Contain-Intrinsic-Size Calibration**:
   - In [`dom-optimizer.js`](../src/modules/dom/dom-optimizer.js), measure candidate element bounding boxes when they first intersect an observer to set element-specific `contain-intrinsic-size: auto ${height}px` dynamically.
2. **Third-Party Iframe Video Deferral**:
   - In [`video-optimizer.js`](../src/modules/videos/video-optimizer.js), add lazy loading for embedded third-party `<iframe>` videos (YouTube, Vimeo) to defer heavy player bundles until interaction.
3. **Automated E2E Extension Testing**:
   - Add Playwright or Puppeteer extension integration tests using `--load-extension` in a real browser instance.
