# Browser Compatibility & API Support Matrix

This document provides a technical assessment of browser engine compatibility and known limitations for **Universal Website Performance Optimizer**.

---

## 1. Compatibility Matrix

| Feature / API | Chrome / Chromium | Microsoft Edge | Brave Browser | Firefox (Gecko) | Safari (WebKit) |
|---|---|---|---|---|---|
| **Manifest Version** | MV3 (Full) | MV3 (Full) | MV3 (Full) | MV3 (Full) | MV3 (Supported) |
| **Declarative Net Request** | Yes (`chrome.declarativeNetRequest`) | Yes | Yes | Yes (Firefox 113+) | Partial (Safari 15.4+) |
| **Session Storage** | Yes (`storage.session`) | Yes | Yes | Yes (Firefox 115+) | Fallback to In-Memory |
| **Content Visibility CSS** | Yes (`content-visibility: auto`) | Yes | Yes | No (Falls back gracefully) | No (Falls back gracefully) |
| **Device Memory API** | Yes (`navigator.deviceMemory`) | Yes | Yes (Shielded) | No (Unexposed) | No (Unexposed) |
| **Hardware Concurrency** | Yes (`hardwareConcurrency`) | Yes | Yes (Capped) | Yes | Yes |
| **Performance Memory** | Yes (`performance.memory`) | Yes | Yes | No (Restricted by design) | No (Restricted by design) |
| **Intersection Observer** | Yes | Yes | Yes | Yes | Yes |
| **Mutation Observer** | Yes | Yes | Yes | Yes | Yes |

---

## 2. Browser-Specific Notes & Limitations

### 2.1 Chromium Browsers (Chrome, Edge, Brave, Opera)
- **Strengths**: Full support for Manifest V3 Declarative Net Request, in-memory `chrome.storage.session`, native `content-visibility: auto`, and `performance.memory` telemetry.
- **Brave**: Brave's built-in Shields fingerprinting protections may randomize or cap `navigator.hardwareConcurrency` and `deviceMemory`. The Adaptive Engine gracefully defaults to conservative thresholds if values are masked.

### 2.2 Mozilla Firefox (Gecko Engine)
- **Memory Metric**: Firefox intentionally does not expose `performance.memory` to prevent micro-architectural side-channel attacks (e.g. Spectre). The Performance Dashboard honestly marks memory as `"Restricted by browser API"` without faking data.
- **Content Visibility**: As of current versions, Gecko does not fully implement CSS `content-visibility: auto`. The DOM optimization module verifies CSS property support before applying, causing no visual errors.

### 2.3 Apple Safari (WebKit)
- **Declarative Net Request**: WebKit enforces strict rule count limits on dynamic rules. The network adapter manages dynamic domain exemptions defensively to stay within WebKit quotas.
- **Session Storage**: If `chrome.storage.session` is unavailable in older WebKit extension builds, the extension automatically falls back to an in-memory runtime cache that is cleared upon tab closure.

---

## 3. Graceful Degradation Principles
- **No Crash Guarantee**: Every experimental or platform-specific Web API (`deviceMemory`, `connection`, `getBattery`, `performance.memory`) is wrapped in safety checks (`if ('api' in object)`).
- **Honest Dashboards**: When an API is unexposed by the host browser, the UI explicitly indicates `"Unexposed by browser"` or `"Restricted"` rather than generating synthetic measurements.

