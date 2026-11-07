# Contributing

1. Run `npm install` and `npm run check` before and after your change. All three steps must pass.
2. Every user-visible control must be backed by a config key that runtime code reads. `tests/audit.test.ts` enforces this for the dashboard.
3. Every page modification must be reversible. Add a test that applies the module and checks that the page HTML is identical after `stop()`.
4. Do not add network calls, persistent storage, remote lists or telemetry. The audit test will fail.
5. Do not display a number unless it is a `Measurement` (measured, estimated with a method, or unavailable with a reason).
6. Adaptive thresholds live in `src/adaptive/decide.ts` and must carry a written rationale.
7. Do not add runtime dependencies. Dev dependencies need a clear reason.
8. Interface copy: no emoji, no em dashes, no unverifiable claims.

Bug reports for broken sites should include the hostname, browser version, the mode, and whether **Pause on this tab** fixes it.
