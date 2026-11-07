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
# REPAIR EXISTING UNIVERSAL WEBSITE PERFORMANCE OPTIMIZER

You are repairing the existing Universal Website Performance Optimizer project in the current workspace.

IMPORTANT:
- Do NOT create a new project.
- Do NOT redesign the project from scratch.
- Preserve the existing UI, architecture and working features unless a change is required to fix them.
- Do NOT run ANY terminal, shell, PowerShell, npm, npx, pnpm, yarn, build, install, test or deployment commands.
- Do NOT download anything.
- Do NOT install dependencies.
- Work only by inspecting and editing the existing project files.
- Do not ask me to run commands.
- Do not claim something is tested if you cannot actually verify it.
- Do not replace real functionality with mock/demo functionality.

## MAIN PROBLEM

The current project contains duplicated TypeScript and JavaScript implementations. The active extension runtime is using the JavaScript entrypoints while several TypeScript optimization modules are not actually connected to the runtime.

Fix the architecture so there is ONE clear source of truth and the functionality that the UI exposes is actually connected to the active extension runtime.

## REQUIRED FIXES

### 1. Runtime architecture
Inspect:
- manifest.json
- background entrypoint
- content entrypoint
- popup
- options
- TypeScript modules
- browser adapters

Determine exactly which files are loaded by the extension.

Connect the existing TypeScript modules properly where appropriate, or consolidate duplicated implementations into one maintainable runtime.

Do not leave unused duplicate implementations that create confusion.

### 2. CPU optimization
Fix the CPU module so it only claims functionality that actually exists.

Implement safe browser-compatible optimization such as:
- background activity management where APIs permit
- visibility-aware processing
- off-screen canvas observation
- cleanup of extension-created observers/listeners
- safe throttling mechanisms where technically possible

Do NOT monkey-patch website timers globally unless there is a safe rollback mechanism and strong compatibility protection.

Do not falsely claim that the extension can directly control arbitrary website CPU usage.

### 3. Memory optimization
Implement real extension-side memory cleanup:
- disconnect observers
- remove event listeners
- clear timers
- release references
- clean tab/session state
- avoid retained DOM references

Do not claim that the extension can arbitrarily free the browser's website memory.

### 4. JavaScript optimization
Use safe blocking rules for genuinely unnecessary third-party resources.

Protect:
- authentication
- login
- payment
- checkout
- CAPTCHA
- navigation
- essential application scripts

Improve the existing rule engine instead of blindly blocking JavaScript.

### 5. Network blocking
Fix the hybrid blocking engine.

It must support:
- built-in rules
- custom rules
- per-site exclusions
- allowlist protection
- browser-compatible request blocking
- safe fallback where declarative blocking APIs aren't available

Custom rules must actually affect runtime behavior.

### 6. Privacy/session storage
The project requirement is session-only operation.

Fix the current dynamic-rule persistence problem.

Do NOT permanently store:
- browsing history
- website contents
- website profiles
- optimization statistics
- browsing data

Use session-scoped mechanisms where supported.

If a browser API cannot guarantee session-only behavior, implement a safe fallback and document it.

When a tab closes, clear its temporary state.

When the browser session ends, temporary configuration/state must not become permanent browsing data.

### 7. Emergency reset
Emergency reset must actually stop optimization.

It must:
- disable active content optimization
- disable applicable blocking rules
- restore modified page behavior where safely reversible
- clear temporary optimization state

Do not leave network blocking active after emergency reset.

### 8. Allowlist
Fix hostname matching.

Allowlist entries must consistently represent hostnames/domains, not mixed URL paths.

Support:
- exact domains
- subdomains
- temporary per-site bypass
- global allowlist

Never accidentally allow unrelated domains because of loose string matching.

### 9. Global settings
When the user changes global configuration, ensure the configuration is correctly propagated to all relevant active tabs.

Do not update only the currently selected tab when the setting is global.

Per-site settings must remain separate from global settings.

### 10. Adaptive engine
Connect the adaptive engine to the actual runtime.

It should determine an optimization plan using available signals such as:
- device capabilities where detectable
- page complexity
- DOM size
- resource activity
- network conditions where available

Modes:
- Balanced
- Performance
- Extreme Lite
- Adaptive Custom

Balanced must remain the default.

Do not invent hardware information that browser APIs cannot provide.

### 11. Image optimization
Ensure the active runtime actually implements the advertised image features:
- safe lazy loading
- async decoding
- off-screen handling
- animated image handling where safely possible

Never download replacement image files.

### 12. Video optimization
Ensure actual runtime behavior supports:
- autoplay prevention
- off-screen pausing
- background-tab handling where safe
- preview reduction where possible

Never break essential media controls.

### 13. Rendering optimization
Keep Balanced mode conservative.

Do NOT globally destroy:
- backdrop blur
- filters
- shadows
- transitions
- layout styling

unless the optimization mode explicitly allows aggressive rendering reduction.

Preserve website usability and appearance as much as possible.

### 14. DOM optimization
Keep DOM optimization conservative.

Never blindly remove website elements.

Use safe mechanisms such as:
- content-visibility where appropriate
- visibility-aware processing
- throttled observation
- efficient extension-side DOM scanning

### 15. Performance metrics
Remove fabricated metrics.

Never hardcode:
- FPS
- long-task counts
- CPU savings
- memory savings
- bandwidth savings

If a metric cannot be measured through available browser APIs, display:
"Unavailable"

or another honest equivalent.

Separate:
- measured values
- estimated values
- unavailable values

Clearly label estimates.

### 16. Before/after comparison
Create a truthful performance comparison system.

Possible measurements:
- resource count
- transferred bytes
- load timing
- resource timing
- long tasks where available
- DOM metrics
- supported memory metrics
- responsiveness metrics where measurable

Do not claim that an optimization saved a specific amount unless the measurement supports it.

### 17. UI
Preserve the current design.

Fix functionality behind the controls rather than replacing the UI.

Every visible control must either:
- work,
- be disabled with an explanation,
- or be removed if technically impossible.

No fake buttons.

### 18. Browser compatibility
Keep the architecture compatible with:
- Chromium browsers
- Firefox
- Safari where extension APIs permit

Use browser adapters rather than assuming Chrome-only APIs everywhere.

Do not claim universal compatibility when an API is unavailable.

### 19. Permissions
Review manifest permissions.

Use the minimum permissions required.

Do not add unnecessary permissions.

### 20. Code quality
Clean:
- duplicated code
- dead code
- contradictory implementations
- unsafe global patches
- memory leaks
- unused imports
- misleading comments
- fake metrics
- incomplete handlers

Keep TypeScript strongly typed and modular.

## FINAL REQUIREMENT

After editing:

1. Inspect the entire project structure.
2. Inspect the manifest and actual runtime entrypoints.
3. Trace every major UI control to its implementation.
4. Trace every optimization module to its runtime usage.
5. Remove or clearly isolate obsolete duplicate implementations.
6. Ensure privacy requirements are reflected in the actual implementation.
7. Ensure the README does not claim features that aren't implemented.
8. Do NOT run commands.
9. Do NOT claim tests passed.
10. At the end, provide a concise list of:
   - files changed
   - major fixes
   - remaining unverified areas
   - features that still require real browser/device testing

The result must be a genuinely functional repair of the existing project, not a rewritten mockup.