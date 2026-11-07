/**
 * Static audits enforced in CI instead of by assertion in prose:
 *  - privacy: no network, no persistent storage, no dynamic code, no remote URLs in the source
 *  - permissions: exact, minimal, identical across browsers
 *  - UI consistency: every control exists in the HTML and every setting is consumed by runtime code
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { GROUPS } from '../src/ui/options/groups';
import { defaultConfig } from '../src/shared/config';
import { BLOCK_LISTS, ESSENTIAL_HOSTS } from '../src/shared/tracker-list';
import { MODULE_NAMES } from '../src/shared/types';

const root = new URL('..', import.meta.url).pathname;
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const srcFiles = walk(join(root, 'src')).filter((f) => f.endsWith('.ts'));
const read = (p: string) => readFileSync(p, 'utf8');
const code = (p: string) => read(p).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

test('privacy: source contains no network APIs, persistent storage or dynamic code', () => {
  const forbidden: Array<[RegExp, string]> = [
    [/\bfetch\s*\(/, 'fetch'], [/XMLHttpRequest/, 'XMLHttpRequest'], [/\bWebSocket\b/, 'WebSocket'], [/\bEventSource\b/, 'EventSource'],
    [/sendBeacon/, 'sendBeacon'], [/importScripts/, 'importScripts'], [/\beval\s*\(/, 'eval'], [/new Function\b/, 'new Function'],
    [/\.innerHTML\s*=|insertAdjacentHTML|document\.write/, 'HTML injection'], [/\b(localStorage|indexedDB)\b|\bsessionStorage\.|(window|globalThis|self)\.sessionStorage/, 'web storage'],
    [/storage\??\.local|storage\??\.sync|storage\??\.managed/, 'persistent extension storage'], [/https?:\/\//, 'URL literal'],
    [/navigator\.getBattery|\bgetBattery\b/, 'battery API (fingerprinting surface)'], [/\bcookies\b|chrome\.history|\.history\.search/, 'cookies or history API']
  ];
  const hits: string[] = [];
  for (const f of srcFiles) {
    const c = code(f);
    for (const [re, name] of forbidden) {
      if (!re.test(c)) continue;
      // chrome-extension:// style prefixes and the tracker filter list are data, not requests; none contain "http(s)://".
      hits.push(`${f.replace(root, '')}: ${name}`);
    }
  }
  assert.deepEqual(hits, []);
});

test('permissions: minimal, identical in both manifests, no broad host access', () => {
  for (const name of ['chromium', 'firefox']) {
    const m = JSON.parse(read(join(root, 'manifest', `${name}.json`)));
    assert.deepEqual([...m.permissions].sort(), ['activeTab', 'declarativeNetRequest', 'storage'], name);
    assert.equal(m.host_permissions, undefined, `${name}: no host_permissions`);
    assert.equal(m.optional_permissions, undefined);
    assert.equal(m.web_accessible_resources, undefined, `${name}: nothing exposed to web pages`);
    assert.equal(m.externally_connectable, undefined, `${name}: no external messaging`);
    assert.equal(m.content_security_policy, undefined, 'default extension CSP is kept');
    assert.deepEqual(m.content_scripts.map((c: { matches: string[] }) => c.matches), [['http://*/*', 'https://*/*']]);
    assert.equal(m.content_scripts[0].all_frames, false);
    assert.ok(!JSON.stringify(m).includes('<all_urls>'));
  }
});

test('rules: bundled blocks are host-anchored, never block navigations, and never touch essential providers', () => {
  for (const [id, entries] of Object.entries(BLOCK_LISTS)) {
    for (const e of entries) {
      assert.ok(e.filter.startsWith('||'), `${id}: ${e.filter}`);
      assert.ok(!e.types.includes('main_frame'), `${id}: ${e.filter} must not block navigations`);
      const host = e.filter.slice(2).split(/[/^*]/)[0] as string;
      for (const ess of ESSENTIAL_HOSTS) {
        const eh = ess.split('/')[0] as string;
        assert.ok(!(host === eh || host.endsWith('.' + eh)), `${e.filter} overlaps essential host ${ess}`);
      }
    }
  }
});

function ids(html: string): Set<string> {
  return new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1] as string));
}

test('UI consistency: every element id used by popup.ts and options.ts exists in its HTML', () => {
  for (const page of ['popup', 'options']) {
    const html = read(join(root, 'src/ui', page, 'index.html'));
    const have = ids(html);
    const used = [...read(join(root, 'src/ui', page, `${page}.ts`)).matchAll(/\$\(\s*'([^']+)'\s*\)/g)].map((m) => m[1] as string);
    const missing = used.filter((u) => !have.has(u));
    assert.deepEqual(missing, [], `${page}: ids missing from HTML`);
  }
});

test('UI consistency: popup module chips cover exactly the module flags', () => {
  const html = read(join(root, 'src/ui/popup/index.html'));
  const chips = [...html.matchAll(/data-module="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(chips, [...MODULE_NAMES].sort());
  const modes = [...html.matchAll(/data-mode="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(modes, ['adaptive', 'balanced', 'extreme', 'performance']);
});

test('UI consistency: every dashboard option maps to a real config key that runtime code reads', () => {
  const cfg = defaultConfig() as unknown as Record<string, Record<string, unknown>>;
  const runtime = walk(join(root, 'src')).filter((f) => /src\/(content|adapters|policy|background)\//.test(f) && f.endsWith('.ts')).map(read).join('\n');
  for (const g of GROUPS) {
    assert.ok(MODULE_NAMES.includes(g.module));
    for (const o of g.opts) {
      const [section, key] = o.path;
      assert.equal(typeof cfg[section]?.[key], 'boolean', `${section}.${key} must exist in the config`);
      assert.ok(new RegExp(`\\b${key}\\b`).test(runtime), `${section}.${key} is never read by runtime code`);
    }
  }
});

test('UI text follows the project rules: no emoji, no em dashes, no placeholders claiming unverified results', () => {
  const files = [...walk(join(root, 'src/ui')), ...walk(join(root, 'docs')).filter((f) => f.endsWith('.md')), join(root, 'README.md')];
  for (const f of files) {
    const t = read(f);
    assert.ok(!/[\u2014\u2013]/.test(t), `${f.replace(root, '')}: contains an en/em dash`);
    assert.ok(!/\p{Extended_Pictographic}/u.test(t), `${f.replace(root, '')}: contains an emoji`);
    assert.ok(!/production[- ]ready|zero telemetry verified|guaranteed|60.{0,3}70\s*%\s*faster/i.test(t.replace(/not (yet )?production[- ]ready/gi, '')), `${f.replace(root, '')}: contains an unsupported claim`);
  }
});
