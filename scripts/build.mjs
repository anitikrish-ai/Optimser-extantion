// Builds dist/chromium and dist/firefox. Safari: convert dist/chromium with Apple's converter (see docs).
import { build } from 'esbuild';
import { mkdirSync, writeFileSync, copyFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { renderIcon } from './icons.mjs';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const targets = ['chromium', 'firefox'];

// Compile the tracker list (TypeScript source of truth) into plain data.
const listOut = join(root, '.build-tmp', 'tracker-list.mjs');
await build({ entryPoints: [join(root, 'src/shared/tracker-list.ts')], outfile: listOut, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const { BLOCK_LISTS, ESSENTIAL_HOSTS, RULE_ID_BASE, RULE_PRIORITY } = await import(listOut);

function rulesets() {
  const out = {};
  for (const [id, entries] of Object.entries(BLOCK_LISTS)) {
    out[id] = entries.map((e, i) => ({
      id: RULE_ID_BASE[id] + i,
      priority: RULE_PRIORITY.bundledBlock,
      action: { type: 'block' },
      condition: { urlFilter: e.filter, resourceTypes: e.types }
    }));
  }
  out.essential = ESSENTIAL_HOSTS.map((h, i) => ({
    id: RULE_ID_BASE.essential + i,
    priority: RULE_PRIORITY.essentialAllow,
    action: { type: 'allow' },
    condition: { urlFilter: h.includes('/') ? `||${h}` : `||${h}^` }
  }));
  return out;
}

const write = (p, data) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, data); };

rmSync(dist, { recursive: true, force: true });
const rs = rulesets();

for (const t of targets) {
  const out = join(dist, t);
  const common = { bundle: true, format: 'iife', target: ['chrome102', 'firefox115'], platform: 'browser', logLevel: 'warning', legalComments: 'none', minify: true };
  await Promise.all([
    build({ ...common, entryPoints: [join(root, 'src/background/main.ts')], outfile: join(out, 'background.js') }),
    build({ ...common, entryPoints: [join(root, 'src/content/main.ts')], outfile: join(out, 'content.js') }),
    build({ ...common, entryPoints: [join(root, 'src/ui/popup/popup.ts')], outfile: join(out, 'popup/popup.js') }),
    build({ ...common, entryPoints: [join(root, 'src/ui/options/options.ts')], outfile: join(out, 'options/options.js') })
  ]);
  copyFileSync(join(root, 'src/ui/popup/index.html'), join(out, 'popup/index.html'));
  copyFileSync(join(root, 'src/ui/popup/popup.css'), join(out, 'popup/popup.css'));
  copyFileSync(join(root, 'src/ui/options/index.html'), join(out, 'options/index.html'));
  copyFileSync(join(root, 'src/ui/options/options.css'), join(out, 'options/options.css'));
  for (const [id, rules] of Object.entries(rs)) write(join(out, 'rules', `${id}.json`), JSON.stringify(rules, null, 2));
  for (const s of [16, 32, 48, 128]) write(join(out, 'icons', `icon${s}.png`), renderIcon(s));
  copyFileSync(join(root, `manifest/${t}.json`), join(out, 'manifest.json'));
}
rmSync(join(root, '.build-tmp'), { recursive: true, force: true });

// ---- validation of the produced extension ----
let errors = 0;
const fail = (m) => { console.error('BUILD CHECK FAILED:', m); errors++; };
for (const t of targets) {
  const out = join(dist, t);
  const m = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
  const refs = [
    m.background?.service_worker, ...(m.background?.scripts ?? []),
    ...m.content_scripts.flatMap((c) => c.js), m.action.default_popup, m.options_ui.page,
    ...Object.values(m.icons), ...Object.values(m.action.default_icon),
    ...m.declarative_net_request.rule_resources.map((r) => r.path)
  ].filter(Boolean);
  for (const r of refs) if (!existsSync(join(out, r))) fail(`${t}: manifest references missing file ${r}`);
  for (const f of ['background.js', 'content.js', 'popup/popup.js', 'options/options.js']) {
    const src = readFileSync(join(out, f), 'utf8');
    if (/^\s*(export|import)\s/m.test(src)) fail(`${t}/${f}: contains module syntax; content scripts must be classic scripts`);
    if (/https?:\/\/[^\s'"`]+/.test(src.replace(/https?:\/\/(www\.)?(w3\.org|developer\.mozilla|github\.com)[^\s'"`]*/g, '')) && /fetch\(|XMLHttpRequest|WebSocket|sendBeacon/.test(src)) {
      fail(`${t}/${f}: contains network API usage and a URL; review for remote calls`);
    }
  }
  const ids = new Set();
  for (const r of m.declarative_net_request.rule_resources) {
    for (const rule of JSON.parse(readFileSync(join(out, r.path), 'utf8'))) {
      if (ids.has(rule.id)) fail(`${t}: duplicate rule id ${rule.id}`);
      ids.add(rule.id);
    }
  }
}
if (errors) process.exit(1);
console.log(`Built ${targets.join(', ')} into dist/ (${targets.length} targets, checks passed).`);
