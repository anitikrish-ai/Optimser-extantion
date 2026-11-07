# BUILD: UNIVERSAL WEBSITE PERFORMANCE OPTIMIZER

Act as a senior browser-extension engineer, performance architect and premium UI/UX designer. Build a complete, functional, production-oriented, free and open-source browser extension that makes heavy websites significantly lighter and more usable on low-end devices.

## CRITICAL INSTRUCTIONS
- Build the actual project and all required files directly in the current workspace.
- Do not just explain, demonstrate, or generate a prototype.
- Do not run ANY terminal commands, shell commands, PowerShell commands, scripts, installations, builds, servers or other commands.
- Do not ask me to run commands.
- Do not install dependencies.
- Do not use external APIs, cloud services, AI services or backends.
- Do not download anything during development or browsing.
- Work directly with files and source code using available workspace editing capabilities.
- If a dependency is unavailable, use native browser APIs instead of installing it.
- Do not stop after creating the UI. Implement the actual optimization functionality.
- Never fake functionality, performance statistics, working controls or completed features.
- Complete as much as technically possible without executing commands.
- Clearly document anything that cannot be verified without running the project.

## 1. PRODUCT MISSION

Create an independent universal browser extension that intelligently reduces unnecessary website resource consumption, targeting up to 60–70% reduction in avoidable overhead where achievable.

It must prioritize:
- CPU efficiency.
- Memory overhead.
- Network requests and transferred data.
- JavaScript execution overhead.
- Image and video loading.
- DOM and rendering workload.
- Animations and expensive visual effects.
- Background activity.

Never promise universal performance improvements or sacrifice essential website functionality for arbitrary optimization scores.

## 2. NON-NEGOTIABLE PRIVACY

100% local-first:
- Zero tracking, telemetry or analytics.
- No login, accounts or registration.
- No backend, cloud or external APIs.
- No browsing-history collection.
- No remote configuration.
- No user data transmission by the extension.
- No downloading or cloning websites.
- No generating replacement website content.
- No persistent browsing preferences.
- No permanent user settings database.

Use temporary in-memory/session-only state. Clear temporary website state when tabs close and remaining session state when the browser session ends. Installed extension files are allowed; browsing data must not persist.

Bundle necessary default rules with the extension. Never fetch filter lists or optimization packages during browsing.

## 3. OPTIMIZATION ENGINE

Build independent, modular optimization systems:

**CPU:** Reduce unnecessary background activity, expensive animations and avoidable processing where browser APIs allow.

**Memory:** Clean up extension-created listeners, observers, timers and references. Avoid unnecessary retained state.

**JavaScript:** Block known unnecessary third-party scripts through safe rules. Protect essential scripts, authentication, navigation and interactive functionality.

**Images:** Smart lazy loading, off-screen loading control and safe image-loading optimizations without creating or downloading replacement copies.

**Videos:** Control autoplay, background playback, unnecessary previews and supported quality preferences.

**CSS/rendering:** Reduce unnecessary animations, transitions, expensive filters, blur and shadows. Preserve layout and readability.

**Network:** Block unnecessary third-party requests, trackers, advertisements and user-defined resources through a hybrid browser-compatible blocking engine.

**DOM:** Apply conservative rendering and visibility optimizations. Never blindly remove website content or essential DOM elements.

Every module must have independent controls and compatibility safeguards.

## 4. ADAPTIVE ENGINE

Automatically evaluate available device capabilities, website workload and connection conditions.

Adapt optimization intensity based on:
- CPU and memory constraints where detectable.
- Mobile versus desktop.
- Network conditions where available.
- Background activity.
- Resource-loading patterns.
- Website functionality and compatibility.

Create four modes:
1. Balanced — default.
2. Performance — stronger safe optimization.
3. Extreme Lite — prioritize responsiveness.
4. Adaptive Custom — automatically adjust user-configurable optimization controls.

Always automatic by default, with manual overrides.

## 5. SAFETY

Implement:
- Website allowlist.
- Per-module disable controls.
- Emergency disable.
- Instant website reset.
- Temporary per-site exclusions.
- Essential-script protection.
- Safe fallback for unsupported APIs.
- Recovery from obvious compatibility problems.

Never interfere with login, payment, forms, navigation, authentication or essential application functionality intentionally.

## 6. PERFORMANCE DASHBOARD

Provide genuine before/after comparisons wherever measurements are available.

Display:
- Loading performance.
- Network requests and transferred bytes.
- Available CPU measurements.
- Available memory measurements.
- Responsiveness and frame performance where measurable.
- Active optimization modules.

Clearly distinguish measured values from estimates and unavailable metrics. Never invent savings or claim that an optimization occurred when it did not.

## 7. UI/UX DESIGN

Create a modern, professional, premium and minimal interface.

**Popup:**
- Main optimization toggle.
- Current website status.
- Active optimization mode.
- Quick optimization controls.
- Safety status.
- Basic performance information.

**Advanced dashboard:**
- CPU, memory, network, scripts, images, videos and rendering sections.
- Individual controls.
- Optimization intensity sliders.
- Website-specific exclusions.
- Custom rules.
- Performance comparisons.
- Session information.
- Reset controls.

Design direction:
- Clean professional interface.
- Subtle Apple-inspired Liquid Glass influence.
- Excellent spacing and alignment.
- Carefully designed typography.
- Smooth, restrained transitions.
- Light and dark themes.
- Responsive layout.
- Accessible controls.
- No excessive gradients, glowing effects or visual clutter.

Use real functional controls, not decorative mockups.

## 8. TECHNOLOGY AND ARCHITECTURE

Preferred:
- WXT-compatible architecture.
- TypeScript.
- Native HTML and CSS.
- WebExtensions APIs.
- Manifest V3 where applicable.
- Declarative Net Request for supported Chromium browsers.
- Browser-specific compatibility adapters.
- Modular, maintainable source code.

Support Chrome, Edge, Brave, Opera, Firefox and Safari where APIs permit. Do not claim compatibility without verification.

Design separate adapters for browser-specific blocking and session-management behavior.

Use the minimum necessary permissions.

## 9. PROJECT STRUCTURE

Create a clean architecture similar to:

performance-optimizer/
├── entrypoints/
│   ├── background.ts
│   ├── content.ts
│   ├── popup/
│   └── options/
├── src/
│   ├── core/
│   ├── adaptive-engine/
│   ├── device-detection/
│   ├── performance-monitor/
│   ├── modules/
│   │   ├── cpu/
│   │   ├── memory/
│   │   ├── scripts/
│   │   ├── images/
│   │   ├── videos/
│   │   ├── rendering/
│   │   └── network/
│   ├── safety/
│   ├── browser-adapters/
│   ├── session/
│   └── shared/
├── assets/
├── tests/
├── docs/
├── LICENSE
├── README.md
└── wxt.config.ts

Adjust the structure when technically necessary, but maintain modular separation.

## 10. CODE QUALITY

- Production-oriented, readable TypeScript.
- No unnecessary dependencies.
- No duplicated logic.
- Strict typing.
- Proper error handling.
- Minimal permissions.
- Efficient event listeners.
- Proper cleanup.
- No memory leaks introduced by the extension.
- No fake implementations.
- No placeholder features presented as completed.
- Keep the extension lightweight.

## 11. OPEN SOURCE AND DISTRIBUTION

Use MIT licensing.

Prepare:
- README with project overview and setup instructions.
- Architecture documentation.
- Privacy documentation.
- Supported browser information.
- Known limitations.
- Manual installation instructions.
- Release packaging guidance.
- GitHub-ready source structure.

Distribution priority:
1. Free browser extension stores where available.
2. GitHub Releases.
3. Personal website.

No paid features or subscriptions.

## 12. FINAL DELIVERY

Build the complete project in the current workspace without running commands.

Before finishing:
- Inspect all created source files.
- Check imports, references and file consistency manually.
- Ensure modules are connected to the actual extension entrypoints.
- Identify incomplete functionality honestly.
- Document browser-specific limitations.
- Provide a concise file and architecture summary.
- Identify which files Claude should inspect first for future refinement.

IMPORTANT: I will later provide this entire project to Claude for code refinement, debugging, security review, performance improvements and UI polishing. Therefore, keep the architecture clean, files organized, documentation clear and implementation easy to understand.

**FINAL PRIORITY: Real functionality > performance > compatibility > privacy > UI polish. All must be respected, but never fake a feature to make the project appear complete.**