# Local-First Privacy Policy & Guarantee

**Universal Website Performance Optimizer** is built on a strict, non-negotiable **100% Local-First Privacy Architecture**.

---

## 1. Zero Telemetry & Tracking
- **Zero External Network Requests**: The extension never contacts any external server, cloud backend, API, or telemetry endpoint.
- **No Analytics**: We do not collect page views, active user counts, crash reports, or feature usage statistics.
- **No Browsing History Collection**: The extension inspects hostnames solely within the local tab context to evaluate safety and allowlist rules. URLs and navigation histories are never persisted.
- **No Accounts or Identification**: There are no user accounts, logins, cookies, or unique client identifiers.

## 2. Session-Bound Ephemeral State
- **No Persistent Database**: Browsing data, tab workload statistics, and metrics are never written to permanent storage (`localStorage` or permanent `chrome.storage.local`).
- **Temporary In-Memory Storage**: Active configurations and tab statistics are stored strictly in `chrome.storage.session` (in-memory) or runtime `Map` structures.
- **Automatic Lifecycle Purge**:
  - When a tab is closed, all associated telemetry and workload data for that tab are immediately deleted.
  - When the browser process terminates, all remaining session configuration and cached metrics are permanently wiped.

## 3. Safe Resource Handling
- **No Content Cloning**: The extension does not clone, download, re-upload, or proxy website content through external optimization proxies.
- **Native Device Execution**: All image lazy loading, script blocking, and rendering optimizations occur directly inside the user's browser engine using native Web APIs.
- **Bundled Default Rules**: All blocking rules and safety lists are bundled locally inside the extension. The extension never downloads external filter lists or remote scripts during runtime.

## 4. Open-Source Verification
The entire codebase is licensed under the MIT License and is fully auditable. You can inspect all network and storage operations in the source repository.

