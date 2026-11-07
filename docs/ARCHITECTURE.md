# System Architecture Specification

## Universal Website Performance Optimizer

This document details the internal design, modular pipelines, safety protocols, and cross-browser adapters of the **Universal Website Performance Optimizer**.

---

## 1. High-Level Architecture (Single Source of Truth)

The extension uses a consolidated, unified architecture where `src/` modules act as the single source of truth across both the background service worker and content scripts, without duplicate or disconnected codebases.

```
+---------------------------------------------------------------------------------------+
|                                    BROWSER RUNTIME                                     |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| BACKGROUND SERVICE WORKER (entrypoints/background.js - type: module)                  |
|  - Imports directly from src/ (session-manager.js, net-request-adapter.js, etc.)      |
|  - Declarative Net Request Orchestrator (Static DNR + Dynamic Exemption & Custom Rules)|
|  - Session State Controller (tab-bound in-memory cache, auto-cleared on tabs.onRemoved)|
|  - Global Config Broadcaster (broadcastMessage propagates updates to all active tabs)  |
+---------------------------------------------------------------------------------------+
            ^                                           ^
            | (chrome.runtime.sendMessage)               | (chrome.runtime.sendMessage)
            v                                           v
+--------------------------------+         +--------------------------------------------+
| POPUP / OPTIONS DASHBOARD      |         | CONTENT SCRIPT (entrypoints/content.js)    |
|  - type: module                |         |  - Sequentially loads src/ modules into     |
|  - Imports directly from src/  |         |    content isolated world                  |
|  - Live Genuine Telemetry      |         |  - Optimizer Core Orchestrator             |
|  - Module Toggles & Sliders    |         |  - Safety & Sensitive Form Guard           |
|  - Dynamic Domain Allowlist    |         |  - 8 Modular Subsystems                    |
|  - Custom Block Rules Engine   |         |  - Native W3C Metrics Collector            |
+--------------------------------+         +--------------------------------------------+
                                                        |
                                                        v
                                           +----------------------------+
                                           | HOST WEBPAGE DOM & RUNTIME |
                                           |  - CSS Injections          |
                                           |  - Image / Video Controls  |
                                           |  - Mutation Observers      |
                                           |  - Beacon Interceptor      |
                                           +----------------------------+
```

---

## 2. Core Subsystems

### 2.1 Safety & Compatibility Engine (`src/safety/`)
- **Safety Manager (`safety-manager.js`)**: Evaluates candidate hostnames and paths prior to applying any optimization.
  - Normalizes input hostnames by stripping protocol, path, port, and trailing slashes.
  - Strict domain matching: matches exact domains and subdomains (`app.example.com` matches `example.com`), `localhost`, and `127.0.0.1`.
  - Intercepts sensitive pathways via regex: `/login`, `/auth`, `/checkout`, `/pay`, `/2fa`, etc.
  - Detects password fields (`input[type="password"]`) and payment input elements (`autocomplete="cc-number"`). If present, optimization switches to high-safety bypass.
- **Emergency Switch (`emergency-switch.js`)**: Provides instantaneous teardown:
  - Immediately removes injected stylesheets (`#uwpo-optimized-rendering-stylesheet`).
  - Disconnects all active observers (`MutationObserver`, `IntersectionObserver`, `PerformanceObserver`).
  - Restores overridden APIs (`navigator.sendBeacon`).
  - Restores paused media elements.

### 2.2 Adaptive Engine (`src/adaptive-engine/`)
- **Device Detector (`device-detector.js`)**: Gathers hardware signals locally without synthetic figures:
  - `navigator.hardwareConcurrency`
  - `navigator.deviceMemory` (GB, where exposed by Chromium)
  - `navigator.connection` (`effectiveType`, `saveData`)
  - Battery level and charging status via `navigator.getBattery()`.
- **Workload Analyzer (`workload-analyzer.js`)**: Monitors live DOM complexity (node count, script density, stylesheet count) and observes long tasks (>50ms) using `PerformanceObserver`.
- **Profile Evaluator (`profile-evaluator.js`)**: Maps device capabilities and live workload to one of four operating profiles:
  1. **Balanced**: Standard safe default (lazy loading, autoplay suppression, non-destructive animation capping, tracker blocking). Preserves backdrop blur, shadows, and filters.
  2. **Performance**: Enhanced safe throttling (longer timer delay, box-shadow reduction, stricter script blocking).
  3. **Extreme Lite**: Aggressive resource conservation for low-end devices (pause all offscreen media, disable transitions/blur/shadows, throttle timers to 5000ms).
  4. **Adaptive Custom**: Dynamically shifts between modes based on real-time hardware telemetry and DOM complexity.

### 2.3 Optimization Modules (`src/modules/`)
1. **CPU Efficiency (`cpu-optimizer.js`)**:
   - Monitors `document.visibilityState` to reduce background page activity.
   - Observes HTML5 `<canvas>` elements with `IntersectionObserver` to halt offscreen rendering loops.
   - Disconnects all observers and event listeners on teardown.
2. **Memory Leak Prevention (`memory-optimizer.js`)**:
   - Central registry for all observers.
   - Employs `WeakSet` to track processed DOM nodes without leaking strong references.
   - Cleans up Performance Resource Timing buffers periodically.
   - Hooks into `window.pagehide` and `window.beforeunload` for guaranteed teardown.
3. **Script Blocker (`script-blocker.js`)**:
   - Content-script level defense that inspects injected `<script>` nodes.
   - Blocks known bloatware (Hotjar, FullStory, CrazyEgg, Mouseflow, Clarity, TikTok Pixel, Facebook Pixel, etc.).
   - Explicitly protects authentication and payment scripts (Stripe, PayPal, Turnstile, reCAPTCHA, Auth0).
   - Intercepts `navigator.sendBeacon` calls destined for analytics endpoints.
4. **Image Optimizer (`image-optimizer.js`)**:
   - Dynamically injects `loading="lazy"` and `decoding="async"` on below-the-fold images.
   - Ensures `aspect-ratio` consistency to prevent Cumulative Layout Shift (CLS).
   - Zero downloading or caching of external image replacements.
5. **Video Optimizer (`video-optimizer.js`)**:
   - Strips unprompted `autoplay` and caps `preload="metadata"`.
   - Pauses offscreen video streams using `IntersectionObserver`.
   - Pauses muted background playback when tabs lose visibility.
   - Restores paused videos on teardown.
6. **Rendering Optimizer (`rendering-optimizer.js`)**:
   - Injects targeted CSS rules into `document.documentElement`.
   - Conservative in Balanced mode (only caps infinite loops on decorative classes).
   - In Extreme mode, disables expensive GPU filters and backdrop blur.
   - Respects `prefers-reduced-motion`.
7. **Network Optimizer (`network-optimizer.js`)**:
   - Tracks total resource requests and data transferred via `PerformanceResourceTiming`.
   - Calculates verified savings from blocked requests with transparent `(est.)` labeling.
8. **DOM Optimizer (`dom-optimizer.js`)**:
   - Applies conservative `content-visibility: auto` to offscreen content containers (`article`, `section`, `footer`).
   - Excludes any container holding interactive forms, headers, or navigation elements.

### 2.4 Hybrid Network Blocking & Session Architecture
- **Declarative Net Request Adapter (`net-request-adapter.js`)**:
  - Toggles static ruleset (`default_performance_rules`).
  - Manages dynamic allowlist domain exemptions (Priority 100).
  - Manages dynamic custom block patterns (Priority 20).
  - Automatically purges dynamic rules on emergency reset and startup to guarantee session-only isolation.
- **Session Manager (`session-manager.js`)**: Binds state to active tab IDs. Automatically purges data when tabs close (`tabs.onRemoved`) and when the browser session terminates.
