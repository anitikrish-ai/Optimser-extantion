# Universal Website Performance Optimizer

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](manifest.json)
[![Privacy: 100% Local-First](https://img.shields.io/badge/Privacy-100%25%20Local--First-green.svg)](docs/PRIVACY.md)

An independent, free, and open-source browser extension that intelligently reduces website resource consumption on low-end and resource-constrained devices, targeting up to a 60–70% reduction in avoidable overhead where achievable.

Built with a **100% local-first privacy architecture**: zero tracking, zero cloud dependencies, zero external APIs, and zero persistent browsing records.

---

## Key Features & Optimization Subsystems

| Subsystem | Core Optimization Mechanism |
|---|---|
| **CPU Efficiency** | Throttles background timers on hidden tabs, pauses off-screen HTML5 canvases, and throttles rapid scroll listeners. |
| **Memory Cleanup** | WeakRef-backed DOM tracking, periodic resource timing purges, and automated teardown upon tab unload. |
| **JavaScript & Bloat** | Blocks heavy third-party telemetry, tracking pixels, and session replay scripts (Hotjar, FullStory, CrazyEgg, etc.) while strictly protecting authentication and payment flows. |
| **Image Overhead** | Enforces native `loading="lazy"` and `decoding="async"`, preserving layout stability without downloading external proxy copies. |
| **Video Playback** | Suppresses unprompted autoplay, caps pre-buffering, and pauses off-screen/background muted video streams via `IntersectionObserver`. |
| **Rendering & CSS** | Eliminates expensive GPU filters (`blur`, `drop-shadow`), disables heavy `backdrop-filter`, and caps infinite CSS keyframe loops. |
| **Network & Data** | Dual-layer blocking engine utilizing Manifest V3 Declarative Net Request (DNR) and content-script beacon interception. |
| **DOM Visibility** | Applies conservative `content-visibility: auto` to below-the-fold content sections without touching interactive forms or navigation. |

---

## Adaptive Optimization Engine

The extension automatically samples hardware capabilities (`navigator.hardwareConcurrency`, `deviceMemory`, connection type, battery level) and live page complexity to dynamically scale optimization intensity:

1. **Balanced (Default)**: Safe, conservative optimizations for daily browsing.
2. **Performance**: Stronger optimizations (longer timer delays, box-shadow reduction, stricter script blocking).
3. **Extreme Lite**: Prioritizes responsiveness on low-spec hardware (pauses all offscreen media, disables transitions/blur/shadows, throttles timers to 5000ms).
4. **Adaptive Custom**: Automatically shifts modes according to real-time device load with full user customization.

---

## 100% Local-First Privacy Guarantee

- **Zero Telemetry**: No tracking, analytics, or background pings.
- **No External Servers**: Does not use remote APIs, AI backends, or external proxies.
- **Session-Only State**: All configurations and metrics are stored in temporary in-memory session structures (`chrome.storage.session`).
- **Instant Purge**: Closing a tab wipes all associated metrics; terminating the browser process clears all remaining session data.
- **Bundled Rules**: All blocking rules and safety signatures are bundled locally with the extension.

---

## Quick Installation & Usage

### Method 1: Immediate Manual Installation (Load Unpacked)
You can load and test the extension directly in your browser without any compilation:

1. Open your Chromium-based browser (Google Chrome, Microsoft Edge, Brave, Opera).
2. Navigate to `chrome://extensions` (or `edge://extensions` / `brave://extensions`).
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** in the top-left toolbar.
5. Select the `Optimiser` workspace directory containing `manifest.json`.
6. The extension is now active. Pin it to your browser toolbar to access the popup and dashboard.

### Method 2: Developer Build with WXT / TypeScript
For developers wishing to modify TypeScript source code or bundle distribution packages:

```bash
# Install development dependencies
npm install

# Start WXT development server with live reload
npm run dev

# Run automated test suite
npm test

# Build production distribution package
npm run build

# Package extension zip for Chrome Web Store / Firefox Add-ons
npm run zip
```

---

## Safety & Compatibility Protocols

The extension includes built-in safeguards to prevent interference with critical website functionality:
- **Automatic Essential Flow Detection**: Automatically bypasses optimization on login, checkout, banking, and 2FA pages (`/login`, `/checkout`, `/oauth`, `/pay`, etc.).
- **Sensitive Input Protection**: Automatically disengages if password inputs or credit card fields are detected in the active view.
- **Essential Script Allowlist**: Strictly protects identity and payment scripts (Cloudflare Turnstile, Google reCAPTCHA, Stripe, PayPal, Auth0).
- **Emergency Reset**: A single click in the popup immediately tears down all active optimizations and restores native browser behavior.
- **Website Allowlist**: Easily add custom domains to the allowlist directly from the popup or dashboard.

---

## Project Structure

```
Optimiser/
├── entrypoints/
│   ├── background.js            # Active Service Worker (ESM, imports from src/)
│   ├── content.js               # Active Content Script bootstrapper
│   ├── popup/
│   │   ├── index.html           # Liquid Glass Popup interface
│   │   ├── popup.css            # Accessible, minimal popup styles
│   │   └── popup.js             # Native Popup execution logic (imports from src/)
│   └── options/
│       ├── index.html           # Advanced Diagnostic Dashboard
│       ├── options.css          # Responsive dashboard styling
│       └── options.js           # Native Options execution logic (imports from src/)
├── src/
│   ├── core/
│   │   └── optimizer-core.js    # Central orchestrator binding all modules
│   ├── adaptive-engine/
│   │   ├── adaptive-controller.js
│   │   └── profile-evaluator.js
│   ├── device-detection/
│   │   ├── device-detector.js
│   │   └── workload-analyzer.js
│   ├── performance-monitor/
│   │   ├── metrics-collector.js # Real W3C Performance API telemetry
│   │   └── stats-aggregator.js  # Honest metrics formatting
│   ├── modules/
│   │   ├── cpu/cpu-optimizer.js
│   │   ├── memory/memory-optimizer.js
│   │   ├── scripts/script-blocker.js
│   │   ├── images/image-optimizer.js
│   │   ├── videos/video-optimizer.js
│   │   ├── rendering/rendering-optimizer.js
│   │   ├── network/network-optimizer.js
│   │   └── dom/dom-optimizer.js
│   ├── safety/
│   │   ├── safety-manager.js
│   │   └── emergency-switch.js
│   ├── browser-adapters/
│   │   ├── browser-api.js
│   │   ├── storage-adapter.js
│   │   └── net-request-adapter.js
│   ├── session/
│   │   └── session-manager.js
│   └── shared/
│       ├── types.ts             # TypeScript definitions and contracts
│       ├── constants.js         # Safe defaults, bloatware & essential patterns
│       └── logger.js            # Zero-overhead local console logger
├── rules/
│   └── default-rules.json       # Declarative Net Request ruleset
├── assets/
│   └── icons/
│       ├── icon.svg             # Extension vector iconography
│       └── generate-png-icons.html # Local in-browser PNG icon generator
├── tests/
│   ├── safety.test.js           # Allowlist and essential script tests
│   ├── adaptive-engine.test.js  # Hardware profile evaluation tests
│   ├── rules.test.js            # Bloatware pattern matching tests
│   └── metrics.test.js          # Telemetry truthfulness tests
├── docs/
│   ├── ARCHITECTURE.md          # Technical architecture specification
│   ├── CLAUDE_HANDOFF.md        # Technical review and refinement guide
│   ├── PRIVACY.md               # Local-first privacy policy
│   └── BROWSER-COMPATIBILITY.md # Browser API support matrix
├── manifest.json                # Standard WebExtension Manifest V3
├── wxt.config.ts                # WXT configuration
├── tsconfig.json                # Strict TypeScript configuration
├── package.json                 # Project manifest
└── LICENSE                      # MIT License
```

---

## Supported Browsers

- **Google Chrome** (Full Manifest V3 support)
- **Microsoft Edge** (Full Manifest V3 support)
- **Brave Browser** (Full support; handles Shield maskings)
- **Opera / Opera GX** (Full support)
- **Mozilla Firefox 115+** (Manifest V3 support; graceful memory API fallback)
- **Apple Safari 15.4+** (Manifest V3 WebKit compatibility)

---

## License

This project is licensed under the [MIT License](LICENSE).
Free and open source for everyone.

