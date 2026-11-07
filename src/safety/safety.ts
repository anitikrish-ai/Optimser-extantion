/**
 * Safety primitives. Pure functions only (no browser APIs) so they are unit-testable
 * and can run in the background worker, the content script and the UI.
 *
 * Safety always has the highest precedence in the policy resolver.
 */
import { ESSENTIAL_HOSTS, LOCAL_HOSTS } from '../shared/tracker-list';

const HOST_LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const HOST_RE = new RegExp(`^(?:${HOST_LABEL}\\.)*${HOST_LABEL}$`);
const IPV6_RE = /^\[[0-9a-f:.]+\]$/;

export const MAX_HOSTNAME_LENGTH = 253;
/** Scheme prefix used only so the URL parser can parse a bare hostname. No request is ever made with it. */
const PARSE_SCHEME = 'http:';

/**
 * Normalizes user input or a URL to a bare lowercase hostname, or returns null.
 * Accepts "Example.com", "https://example.com:8080/x", "*.example.com".
 * Rejects anything that is not a syntactically valid hostname.
 */
export function normalizeHostname(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let s = input.trim().toLowerCase();
  if (!s || s.length > 2048) return null;
  s = s.replace(/^\*\./, '');
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(s);
  if (!hasScheme && /^[a-z][a-z0-9+.-]*:/.test(s) && !/^[^/]*:\d+(\/|$)/.test(s) && !s.startsWith('[')) {
    // "javascript:...", "data:..." and similar are never hostnames.
    return null;
  }
  let host: string;
  try {
    host = new URL(hasScheme ? s : `${PARSE_SCHEME}//${s}`).hostname;
  } catch {
    return null;
  }
  if (host.endsWith('.')) host = host.slice(0, -1);
  if (!host || host.length > MAX_HOSTNAME_LENGTH) return null;
  if (IPV6_RE.test(host)) return host;
  return HOST_RE.test(host) ? host : null;
}

/** True when `host` equals `entry` or is a subdomain of it (label-boundary match). */
export function hostMatches(host: string, entry: string): boolean {
  if (!host || !entry) return false;
  return host === entry || host.endsWith('.' + entry);
}

export function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.includes(host) || host.endsWith('.localhost');
}

const ESSENTIAL_HOST_ONLY: readonly string[] = ESSENTIAL_HOSTS.filter((h) => !h.includes('/'));

/** Pages served from these hosts (identity, payment, CAPTCHA providers, localhost) are never optimized. */
export function isBuiltinProtectedHost(host: string): boolean {
  if (isLocalHost(host)) return true;
  return ESSENTIAL_HOST_ONLY.some((e) => hostMatches(host, e));
}

export function isAllowlisted(host: string, allowlist: readonly string[]): boolean {
  if (!host || !Array.isArray(allowlist)) return false;
  for (const raw of allowlist) {
    const entry = normalizeHostname(raw);
    if (entry && hostMatches(host, entry)) return true;
  }
  return false;
}

/**
 * Would blocking requests to host+path interfere with an essential (auth, payment, CAPTCHA) provider?
 * Used to reject custom block rules. `path` starts with "/" or is "".
 */
export function touchesEssentialTarget(host: string, path: string): boolean {
  for (const entry of ESSENTIAL_HOSTS) {
    const slash = entry.indexOf('/');
    const eHost = slash === -1 ? entry : entry.slice(0, slash);
    const ePath = slash === -1 ? '' : entry.slice(slash);
    if (!hostMatches(host, eHost)) continue;
    if (!ePath) return true;
    if (path === '' || path.startsWith(ePath) || path.includes(ePath.slice(1))) return true;
  }
  return false;
}

/**
 * URL path segments that indicate authentication, payment or account-security flows.
 * Matching is by whole path segment so that "/author/" or "/cartoon/" are NOT matched.
 */
const ESSENTIAL_SEGMENTS: ReadonlySet<string> = new Set([
  'login', 'log-in', 'logon', 'signin', 'sign-in', 'signup', 'sign-up', 'register',
  'auth', 'oauth', 'oauth2', 'sso', 'saml', 'authorize', 'authenticate',
  '2fa', 'mfa', 'otp', 'verify', 'password', 'checkout', 'cart', 'basket',
  'payment', 'payments', 'billing', 'pay'
]);

export function isEssentialPath(pathname: string, hash = ''): boolean {
  const candidates: string[] = [pathname || ''];
  // Hash-routed single-page apps: "#/login".
  if (hash.startsWith('#/')) candidates.push(hash.slice(1));
  for (const c of candidates) {
    const segs = c.split(/[/?#]/);
    for (const raw of segs) {
      if (!raw) continue;
      let seg = raw.toLowerCase();
      try {
        seg = decodeURIComponent(seg);
      } catch {
        /* keep raw segment */
      }
      if (ESSENTIAL_SEGMENTS.has(seg)) return true;
    }
  }
  return false;
}

/** DOM selectors that indicate credentials, payment details or CAPTCHA/payment widgets. */
export const SENSITIVE_INPUT_SELECTOR = [
  'input[type="password"]',
  'input[autocomplete^="cc-"]',
  'input[autocomplete="one-time-code"]',
  'input[autocomplete="current-password"]',
  'input[autocomplete="new-password"]',
  'iframe[src*="js.stripe.com"]',
  'iframe[src*="paypal.com"]',
  'iframe[src*="hcaptcha.com"]',
  'iframe[src*="google.com/recaptcha"]',
  'iframe[src*="recaptcha.net"]',
  'iframe[src*="challenges.cloudflare.com"]'
].join(',');
