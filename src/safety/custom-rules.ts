/**
 * Custom block rules.
 *
 * Grammar (intentionally narrow):  [||]hostname[/path]
 *   - hostname: valid DNS name with at least two labels (no IPs, no bare TLDs, no file names).
 *   - path:     optional, begins with "/", may contain "*" wildcards.
 *
 * Why narrow: free-form substrings such as ".js" or "ad" would block large parts of the web.
 * Anchoring every rule to a hostname bounds the blast radius. Patterns are compiled to
 * declarativeNetRequest urlFilters, which are NOT regular expressions, so ReDoS is not possible.
 */
import { normalizeHostname, touchesEssentialTarget } from './safety';
import { RULE_ID_BASE, RULE_PRIORITY } from '../shared/tracker-list';

export const MAX_CUSTOM_RULES = 100;
export const MAX_RULE_LENGTH = 200;

export type RuleValidation = { ok: true; normalized: string } | { ok: false; error: string };

const FILE_EXTENSIONS = new Set([
  'js', 'mjs', 'css', 'json', 'html', 'htm', 'php', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp',
  'ico', 'woff', 'woff2', 'ttf', 'mp4', 'webm', 'map', 'txt', 'xml', 'wasm'
]);

// Small guard list. A full public-suffix list is deliberately not bundled (size, staleness).
const COMMON_PUBLIC_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'co.in', 'co.jp', 'com.br', 'co.nz', 'co.za',
  'com.cn', 'com.mx', 'com.tr', 'co.kr'
]);

const PATH_RE = /^\/[A-Za-z0-9._~\-/%?=&*^:@+,;!]*$/;

export function validateCustomRule(input: unknown): RuleValidation {
  if (typeof input !== 'string') return { ok: false, error: 'Rule must be text.' };
  const raw = input.trim();
  if (!raw) return { ok: false, error: 'Rule is empty.' };
  if (raw.length > MAX_RULE_LENGTH) return { ok: false, error: `Rule is longer than ${MAX_RULE_LENGTH} characters.` };
  if (/\s/.test(raw)) return { ok: false, error: 'Rule must not contain spaces.' };
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    return { ok: false, error: 'Enter a hostname, not a full URL (for example: adservice.example.com).' };
  }

  const body = raw.startsWith('||') ? raw.slice(2) : raw;
  const slash = body.indexOf('/');
  const hostPart = slash === -1 ? body : body.slice(0, slash);
  const pathPart = slash === -1 ? '' : body.slice(slash);

  if (hostPart.includes('*')) return { ok: false, error: 'Wildcards are only allowed in the path part.' };
  const host = normalizeHostname(hostPart);
  if (!host || host !== hostPart.toLowerCase().replace(/\.$/, '')) {
    return { ok: false, error: 'Start the rule with a valid hostname, for example tracker.example.com.' };
  }
  if (host.startsWith('[') || /^\d+(\.\d+){3}$/.test(host)) {
    return { ok: false, error: 'IP addresses are not supported.' };
  }
  const labels = host.split('.');
  if (labels.length < 2) return { ok: false, error: 'The hostname needs at least two parts (name.tld).' };
  const tld = labels[labels.length - 1] as string;
  if (FILE_EXTENSIONS.has(tld)) {
    return { ok: false, error: 'This looks like a file name. Rules must start with a hostname.' };
  }
  if (!/^[a-z]{2,}$|^xn--[a-z0-9-]+$/.test(tld)) {
    return { ok: false, error: 'The last part of the hostname is not a valid top-level domain.' };
  }
  if (COMMON_PUBLIC_SUFFIXES.has(host)) {
    return { ok: false, error: 'This would match an entire registry suffix. Name a specific site.' };
  }
  if (pathPart) {
    if (!PATH_RE.test(pathPart)) return { ok: false, error: 'The path contains unsupported characters.' };
    if (pathPart.replace(/[*^/]/g, '').length < 1) {
      return { ok: false, error: 'The path must contain at least one literal character.' };
    }
  }
  if (touchesEssentialTarget(host, pathPart)) {
    return { ok: false, error: 'This target belongs to an authentication, payment or CAPTCHA provider and is protected.' };
  }
  return { ok: true, normalized: host + pathPart };
}

/** Converts a validated rule to a declarativeNetRequest urlFilter. */
export function toUrlFilter(normalized: string): string {
  const slash = normalized.indexOf('/');
  return slash === -1 ? `||${normalized}^` : `||${normalized}`;
}

export interface DnrRule {
  id: number;
  priority: number;
  action: { type: 'block' | 'allow' };
  condition: {
    urlFilter?: string;
    resourceTypes?: string[];
    initiatorDomains?: string[];
    tabIds?: number[];
  };
}

const CUSTOM_RESOURCE_TYPES = ['script', 'xmlhttprequest', 'ping', 'sub_frame', 'image', 'media', 'font', 'other'];

/** Compiles validated rules into session rules. Invalid entries are silently skipped (defence in depth). */
export function compileCustomRules(patterns: readonly string[]): DnrRule[] {
  const rules: DnrRule[] = [];
  const seen = new Set<string>();
  for (const p of patterns) {
    const v = validateCustomRule(p);
    if (!v.ok || seen.has(v.normalized)) continue;
    seen.add(v.normalized);
    if (rules.length >= MAX_CUSTOM_RULES) break;
    rules.push({
      id: RULE_ID_BASE.sessionCustomBase + rules.length,
      priority: RULE_PRIORITY.customBlock,
      action: { type: 'block' },
      condition: { urlFilter: toUrlFilter(v.normalized), resourceTypes: CUSTOM_RESOURCE_TYPES }
    });
  }
  return rules;
}
