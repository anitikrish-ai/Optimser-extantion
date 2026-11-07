import { $, clear, el, setBusy } from '../dom';
import { getState, request, setConfig } from '../client';
import type { Ack, StateView } from '../../shared/messages';
import type { Config, ModeSetting, ModuleName } from '../../shared/types';
import { MODULE_NAMES } from '../../shared/types';
import { validateCustomRule, MAX_CUSTOM_RULES } from '../../safety/custom-rules';
import { normalizeHostname } from '../../safety/safety';
import { THRESHOLDS } from '../../adaptive/decide';
import { readDeviceSignals } from '../../content/signals';
import { ESSENTIAL_HOSTS } from '../../shared/tracker-list';
import { cloneConfig, MAX_ALLOWLIST } from '../../shared/config';
import { GROUPS } from './groups';
import type { Path } from './groups';

let view: StateView | null = null;

function notice(text: string | null, error = false): void {
  const n = $('notice');
  n.hidden = text === null;
  n.className = error ? 'notice error' : 'notice';
  n.textContent = text ?? '';
}

const getPath = (c: Config, p: Path): boolean => (c[p[0]] as unknown as Record<string, boolean>)[p[1]] as boolean;

async function save(next: Config, okMessage?: string): Promise<void> {
  const ack = await setConfig(next);
  if (!ack || !ack.ok) {
    notice('Could not save the change.', true);
  } else if (ack.issues && ack.issues.length > 0) {
    notice(`Saved with changes: ${ack.issues.slice(0, 3).join(' ')}`, true);
  } else if (ack.warnings && ack.warnings.length > 0) {
    notice(ack.warnings[0] as string, true);
  } else {
    notice(okMessage ?? null);
  }
  await load();
}

function renderOverview(): void {
  if (!view) return;
  ($('select-global-mode') as HTMLSelectElement).value = view.config.mode;
  const sig = readDeviceSignals(navigator);
  const row = (k: string, v: string) => el('div', { class: 'diag-row' }, [el('span', { class: 'diag-key', text: k }), el('span', { class: 'diag-val', text: v })]);
  const s = $('signals');
  clear(s);
  s.append(
    row('Logical cores', sig.cores === null ? 'Unavailable' : String(sig.cores)),
    row('Device memory', sig.memoryGB === null ? 'Unavailable in this browser' : `${sig.memoryGB} GiB (bucketed by the browser)`),
    row('Connection type', sig.effectiveType ?? 'Unavailable in this browser'),
    row('Data saver', sig.saveData === null ? 'Unavailable in this browser' : sig.saveData ? 'On' : 'Off')
  );
  const c = $('caps');
  clear(c);
  const yn = (b: boolean) => (b ? 'Supported' : 'Not supported');
  c.append(
    row('Request blocking', yn(view.caps.dnr)),
    row('Session-only rules', yn(view.caps.dnrSessionRules)),
    row('Blocked-request count', yn(view.caps.dnrMatchedRules)),
    row('Session storage', yn(view.caps.sessionStorage))
  );
  const t = $('thresholds');
  clear(t);
  t.append(
    row('Cores', `<= ${THRESHOLDS.coresLow}: +2, <= ${THRESHOLDS.coresModerate}: +1`),
    row('Memory (GiB)', `<= ${THRESHOLDS.memoryLowGB}: +2, <= ${THRESHOLDS.memoryModerateGB}: +1`),
    row('Network', '2g: +2, 3g: +1, Data saver: +1'),
    row('DOM elements', `> ${THRESHOLDS.domModerate}: +1, > ${THRESHOLDS.domHigh}: +2`),
    row('Requests', `> ${THRESHOLDS.resourcesModerate}: +1, > ${THRESHOLDS.resourcesHigh}: +2`),
    row('Long task time (ms)', `> ${THRESHOLDS.longTaskModerateMs}: +1, > ${THRESHOLDS.longTaskHighMs}: +2`),
    row('Level', `>= ${THRESHOLDS.performanceAt}: performance, >= ${THRESHOLDS.extremeAt}: extreme (after load only)`)
  );
}

function renderModules(): void {
  if (!view) return;
  const cfg = view.config;
  const stack = $('modules-stack');
  clear(stack);
  for (const g of GROUPS) {
    const unsupported = g.module === 'network' && !view.caps.dnr;
    const master = el('input', { attrs: { type: 'checkbox', 'aria-label': `${g.title} module` } });
    master.checked = cfg.modules[g.module];
    master.disabled = unsupported;
    master.addEventListener('change', () => { const n = cloneConfig(cfg); n.modules[g.module] = master.checked; void save(n); });
    const card = el('div', { class: 'glass-card' }, [
      el('div', { class: 'module-header' }, [
        el('div', { class: 'module-title-wrap' }, [el('h3', { text: g.title }), el('p', { class: 'module-desc', text: unsupported ? 'Not supported by this browser.' : g.desc })]),
        el('label', { class: 'switch' }, [master, el('span', { class: 'slider' })])
      ])
    ]);
    const opts = el('div', { class: 'module-options' });
    for (const o of g.opts) {
      const cb = el('input', { attrs: { type: 'checkbox' } });
      cb.checked = getPath(cfg, o.path);
      cb.disabled = unsupported || !cfg.modules[g.module];
      cb.addEventListener('change', () => {
        const n = cloneConfig(cfg);
        (n[o.path[0]] as unknown as Record<string, boolean>)[o.path[1]] = cb.checked;
        void save(n);
      });
      const label = el('label', { class: 'checkbox-label' }, [cb, el('span', { text: o.label })]);
      opts.append(label);
      if (o.note) opts.append(el('span', { class: 'opt-note', text: o.note }));
    }
    card.append(opts);
    stack.append(card);
  }
}

function renderSites(): void {
  if (!view) return;
  const cfg = view.config;
  const body = $('allowlist-tbody');
  clear(body);
  if (cfg.allowlist.length === 0) body.append(el('tr', {}, [el('td', { class: 'empty', text: 'No sites skipped.', attrs: { colspan: '2' } })]));
  for (const h of cfg.allowlist) {
    const b = el('button', { class: 'btn btn-secondary btn-sm', text: 'Remove', attrs: { type: 'button', 'aria-label': `Remove ${h}` } });
    b.addEventListener('click', () => { const n = cloneConfig(cfg); n.allowlist = n.allowlist.filter((x) => x !== h); void save(n); });
    body.append(el('tr', {}, [el('td', {}, [el('strong', { text: h })]), el('td', {}, [b])]));
  }

  const sites = $('sites-tbody');
  clear(sites);
  const keys = Object.keys(cfg.sites);
  if (keys.length === 0) sites.append(el('tr', {}, [el('td', { class: 'empty', text: 'No per-site settings.', attrs: { colspan: '4' } })]));
  for (const h of keys) {
    const ov = cfg.sites[h];
    if (!ov) continue;
    const mods = el('div', { class: 'site-mods' });
    for (const m of MODULE_NAMES) {
      const state = ov.modules?.[m];
      mods.append(el('span', { text: `${m}: ${state === undefined ? 'global' : state ? 'on' : 'off'}` }));
    }
    const b = el('button', { class: 'btn btn-secondary btn-sm', text: 'Remove', attrs: { type: 'button', 'aria-label': `Remove settings for ${h}` } });
    b.addEventListener('click', () => { const n = cloneConfig(cfg); delete n.sites[h]; void save(n); });
    sites.append(el('tr', {}, [el('td', {}, [el('strong', { text: h })]), el('td', { text: ov.mode ?? 'global' }), el('td', {}, [mods]), el('td', {}, [b])]));
  }
  $('builtin-list').textContent = `Includes: ${ESSENTIAL_HOSTS.filter((h) => !h.includes('/')).join(', ')}, localhost.`;
}

function renderRules(): void {
  if (!view) return;
  const cfg = view.config;
  const ul = $('custom-rules-ul');
  clear(ul);
  const supported = view.caps.dnr;
  ($('btn-add-rule') as HTMLButtonElement).disabled = !supported;
  ($('input-new-rule') as HTMLInputElement).disabled = !supported;
  if (!supported) ul.append(el('li', { class: 'custom-rule-item empty', text: 'Request blocking is not supported by this browser.' }));
  else if (cfg.customRules.length === 0) ul.append(el('li', { class: 'custom-rule-item empty', text: 'No custom rules.' }));
  for (const r of cfg.customRules) {
    const b = el('button', { class: 'btn btn-secondary btn-sm', text: 'Remove', attrs: { type: 'button', 'aria-label': `Remove rule ${r}` } });
    b.addEventListener('click', () => { const n = cloneConfig(cfg); n.customRules = n.customRules.filter((x) => x !== r); void save(n); });
    ul.append(el('li', { class: 'custom-rule-item' }, [el('code', { text: r }), b]));
  }
}

function renderPrivacy(): void {
  const list = $('perm-list');
  clear(list);
  for (const [name, why] of [
    ['storage', 'Keeps settings and per-tab data in session storage, which is cleared when the browser closes.'],
    ['declarativeNetRequest', 'Lets the browser itself block listed requests. The extension never sees request contents.'],
    ['activeTab', 'Lets the popup read how many requests were blocked on the tab you opened it on.'],
    ['Content script on http and https pages', 'Applies the page-level optimizations. It runs in the top frame only.']
  ] as const) list.append(el('li', {}, [el('strong', { text: `${name}: ` }), why]));
}

async function load(): Promise<void> {
  const v = await getState(null);
  if (!v) {
    notice('Could not reach the extension background. Reload the extension and try again.', true);
    $('main').setAttribute('aria-busy', 'false');
    return;
  }
  view = v;
  $('main').setAttribute('aria-busy', 'false');
  renderOverview();
  renderModules();
  renderSites();
  renderRules();
}

function bind(): void {
  const nav = Array.from(document.querySelectorAll<HTMLAnchorElement>('.nav-item'));
  const show = (tab: string) => {
    nav.forEach((n) => n.classList.toggle('active', n.dataset.tab === tab));
    document.querySelectorAll('.content-tab').forEach((s) => s.classList.toggle('active', s.id === `tab-${tab}`));
  };
  nav.forEach((n) => n.addEventListener('click', (e) => { e.preventDefault(); show(n.dataset.tab as string); history.replaceState(null, '', `#${n.dataset.tab}`); }));
  const initial = location.hash.slice(1);
  if (nav.some((n) => n.dataset.tab === initial)) show(initial);

  $('select-global-mode').addEventListener('change', (e) => {
    if (view) { const n = cloneConfig(view.config); n.mode = (e.target as HTMLSelectElement).value as ModeSetting; void save(n); }
  });

  $('btn-add-domain').addEventListener('click', () => {
    if (!view) return;
    const input = $('input-new-domain') as HTMLInputElement;
    const h = normalizeHostname(input.value);
    if (!h) { notice('Enter a valid hostname, for example mybank.com.', true); return; }
    if (view.config.allowlist.length >= MAX_ALLOWLIST) { notice('The skip list is full.', true); return; }
    if (view.config.allowlist.includes(h)) { notice(`${h} is already on the list.`, true); return; }
    const n = cloneConfig(view.config); n.allowlist.push(h); input.value = '';
    void save(n, `${h} will no longer be optimized.`);
  });

  const addRule = () => {
    if (!view) return;
    const input = $('input-new-rule') as HTMLInputElement;
    const err = $('rule-error');
    const v = validateCustomRule(input.value);
    if (!v.ok) { err.hidden = false; err.textContent = v.error; return; }
    err.hidden = true;
    if (view.config.customRules.includes(v.normalized)) { err.hidden = false; err.textContent = 'That rule already exists.'; return; }
    if (view.config.customRules.length >= MAX_CUSTOM_RULES) { err.hidden = false; err.textContent = `At most ${MAX_CUSTOM_RULES} rules are allowed.`; return; }
    const n = cloneConfig(view.config); n.customRules.push(v.normalized); input.value = '';
    void save(n, 'Rule added.');
  };
  $('btn-add-rule').addEventListener('click', addRule);
  $('input-new-rule').addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') addRule(); });

  $('btn-export').addEventListener('click', () => {
    if (!view) return;
    const blob = new Blob([JSON.stringify(view.config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { attrs: { href: url, download: 'uwpo-settings.json' } });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('btn-import').addEventListener('click', () => $('file-import').click());
  $('file-import').addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 256 * 1024) { notice('That file is too large to be a settings export.', true); return; }
    try { await save(JSON.parse(await file.text()) as Config, 'Settings imported.'); }
    catch { notice('That file is not valid JSON.', true); }
  });

  const run = async (btn: HTMLElement, type: 'CLEAR_SESSION' | 'RESET_ALL', confirmText: string, done: string) => {
    if (!window.confirm(confirmText)) return;
    setBusy(btn as HTMLButtonElement, true);
    const ack = await request<Ack>({ type });
    setBusy(btn as HTMLButtonElement, false);
    notice(ack?.ok ? done : 'The action failed.', !ack?.ok);
    await load();
  };
  $('btn-clear-session').addEventListener('click', (e) => void run(e.currentTarget as HTMLElement, 'CLEAR_SESSION', 'Remove all stored tab data, measurements and tab pauses?', 'Tab data cleared.'));
  $('btn-reset-all').addEventListener('click', (e) => void run(e.currentTarget as HTMLElement, 'RESET_ALL', 'Reset all settings to their defaults and clear all stored data?', 'Everything was reset.'));
}

renderPrivacy();
bind();
void load();
