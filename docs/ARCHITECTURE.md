# System Architecture Specification

## Universal Website Performance Optimizer

This document details the internal design, modular pipelines, safety protocols, and cross-browser adapters of the **Universal Website Performance Optimizer**.

---

## 1. High-Level Architecture

```
+---------------------------------------------------------------------------------------+
|                                    BROWSER RUNTIME                                     |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| BACKGROUND SERVICE WORKER (entrypoints/background.ts, entrypoints/background.js)      |
|  - Declarative Net Request Manager (DNR Static & Dynamic Rule Orchestration)         |
|  - Tab & Session Lifecycle Controller (sessionManager, automatic cleanup on close)    |
|  - Cross-Tab Communication Dispatcher (ActiveTab Messaging)                          |
+---------------------------------------------------------------------------------------+
            ^                                           ^
            | (chrome.runtime.sendMessage)               | (chrome.runtime.sendMessage)
            v                                           v
+--------------------------------+         +--------------------------------------------+
| POPUP / OPTIONS DASHBOARD      |         | CONTENT SCRIPT (entrypoints/content.ts)    |
|  - Premium Liquid Glass UI     |         |  - Optimizer Core Orchestrator             |
|  - Live Genuine Telemetry      |         |  - Safety & Flow Guard                     |
|  - Module Toggles & Sliders    |         |  - 8 Modular Subsystems                    |
|  - Dynamic Domain Allowlist    |         |  - Native W3C Metrics Collector            |
+--------------------------------+         +--------------------------------------------+
                                                        |
                                                        v
                                           +----------------------------+
                                           | HOST WEBPAGE DOM & RUNTIME |
                                           |  - CSS Injections          |
                                           |  - Image / Video Controls  |
                                           |  - Mutation Observers      |
                                           |  - Timer / Beacon Guards   |
                                           +----------------------------+
```

---

## 2. Core Subsystems

### 2.1 Safety & Compatibility Engine (`src/safety/`)
- **Safety Manager (`safety-manager.ts`)**: Evaluates candidate hostnames and paths prior to applying any optimization.
  - Matches exact domains, subdomains, localhost, and loopback addresses.
  - Intercepts sensitive pathways via regex: `/login`, `/auth`, `/checkout`, `/pay`, `/2fa`, etc.
  - Detects password fields (`input[type="password"]`) and payment input elements (`autocomplete="cc-number"`). If present, optimization switches to high-safety bypass.
- **Emergency Switch (`emergency-switch.ts`)**: Provides instantaneous teardown:
  - Immediately removes injected stylesheets (`#uwpo-optimized-rendering-stylesheet`).
  - Disconnects all active observers (`MutationObserver`, `IntersectionObserver`, `PerformanceObserver`).
  - Restores overridden APIs (`navigator.sendBeacon`).

### 2.2 Adaptive Engine (`src/adaptive-engine/`)
- **Device Detector (`device-detector.ts`)**: Gathers hardware signals locally:
  - `navigator.hardwareConcurrency`
  - `navigator.deviceMemory` (GB)
  - `navigator.connection` (`effectiveType`, `saveData`)
  - Battery level and charging status via `navigator.getBattery()`.
- **Workload Analyzer (`workload-analyzer.ts`)**: Monitors live DOM complexity (node count, script density, stylesheet count) and observes long tasks (>50ms) using `PerformanceObserver`.
- **Profile Evaluator (`profile-evaluator.ts`)**: Maps device capabilities and live workload to one of four operating profiles:
  1. **Balanced**: Standard safe default (lazy loading, autoplay suppression, filter clamping, tracker blocking).
  2. **Performance**: Enhanced throttling (increased timer intervals, box-shadow reduction, stricter script blocking).
  3. **Extreme Lite**: Aggressive resource conservation for low-end devices (pause all offscreen media, disable transitions/blur/shadows, throttle timers to 5000ms).
  4. **Adaptive Custom**: Dynamically shifts between modes based on real-time hardware telemetry.

### 2.3 Optimization Modules (`src/modules/`)
1. **CPU Optimizer (`cpu-optimizer.ts`)**:
   - Monitors `document.visibilityState`.
   - Throttles background timers when tabs are hidden.
   - Observes HTML5 `<canvas>` elements with `IntersectionObserver` to halt offscreen rendering loops.
2. **Memory Optimizer (`memory-optimizer.ts`)**:
   - Central registry for all observers.
   - Employs `WeakSet` to track processed DOM nodes without leaking strong references.
   - Cleans up Performance Resource Timing buffers periodically.
   - Hooks into `window.pagehide` and `window.beforeunload` for guaranteed teardown.
3. **Script Blocker (`script-blocker.ts`)**:
   - Content-script level defense that inspects injected `<script>` nodes.
   - Blocks known bloatware (Hotjar, FullStory, CrazyEgg, TikTok Pixel, Facebook Pixel, etc.).
   - Explicitly protects authentication and payment scripts (Stripe, PayPal, Turnstile, reCAPTCHA).
   - Intercepts `navigator.sendBeacon` calls destined for analytics endpoints.
4. **Image Optimizer (`image-optimizer.ts`)**:
   - Dynamically injects `loading="lazy"` and `decoding="async"` on below-the-fold images.
   - Ensures `aspect-ratio` consistency to prevent Cumulative Layout Shift (CLS).
   - Zero downloading or caching of external image replacements.
5. **Video Optimizer (`video-optimizer.ts`)**:
   - Strips unprompted `autoplay` and caps `preload="metadata"`.
   - Pauses offscreen video streams using `IntersectionObserver`.
   - Pauses muted background playback when tabs lose visibility.
6. **Rendering Optimizer (`rendering-optimizer.ts`)**:
   - Injects targeted CSS rules into `document.documentElement`.
   - Disables expensive GPU filters (`blur()`, `drop-shadow()`).
   - Disables `backdrop-filter` which causes substantial layer repainting on low-end integrated GPUs.
   - Caps infinite animation keyframes and respects reduced-motion preferences.
7. **Network Optimizer (`network-optimizer.ts`)**:
   - Tracks total resource requests and data transferred via `PerformanceResourceTiming`.
   - Calculates verified savings from blocked requests without fabricating artificial metrics.
8. **DOM Optimizer (`dom-optimizer.ts`)**:
   - Applies conservative `content-visibility: auto` to offscreen content containers (`article`, `section`, `footer`).
   - Excludes any container holding interactive forms, headers, or navigation elements.
   - Batches DOM mutation processing with `requestAnimationFrame`.

### 2.4 Browser Abstraction & Session Architecture (`src/browser-adapters/`, `src/session/`)
- **Browser API Adapter (`browser-api.ts`)**: Normalizes differences between `chrome.*` and `browser.*` across Chromium, Firefox, and Safari.
- **Session Storage Adapter (`storage-adapter.ts`)**: Enforces temporary session storage (`chrome.storage.session`) with an in-memory fallback.
- **Session Manager (`session-manager.ts`)**: Binds state to active tab IDs. Automatically purges data when tabs close (`tabs.onRemoved`) and when the browser session terminates.

---

## 3. Network Blocking Mechanics

The extension leverages a **dual-layer network blocking architecture**:
1. **Declarative Net Request (MV3 DNR)**: Static ruleset (`rules/default-rules.json`) executing at browser engine level with zero JavaScript overhead. Priority rules ensure essential authentication providers (`stripe.com`, `paypal.com`, `turnstile`, `recaptcha`) are unconditionally permitted.
2. **Runtime Content Script Interception**: Catches dynamic script injections and telemetry beacons that evade network-level filters or occur within single-page applications.

