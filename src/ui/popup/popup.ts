import { $, clear, el, setBusy } from '../dom';
import { activeTabId, getState, openOptions, request, setConfig } from '../client';
import type { Ack, CompareView, StateView } from '../../shared/messages';
import type { Config, ModeSetting, ModuleName } from '../../shared/types';
import { hasSiteOverride, resetSite, setMode, setModule, toggleAllowlist } from '../../policy/edit';
import type { Scope } from '../../policy/edit';
import { resolveEffective } from '../../policy/resolve';
import { display } from '../../metrics/format';
import { compareSamples } from '../../metrics/compare';
import { formatValue } from '../../metrics/format';
import type { Measurement, PageSample } from '../../shared/measure';
import type { OffReason } from '../../shared/types';

let tabId: number | null = null;
let view: StateView | null = null;
let scope: Scope = 'site';
let pollTimer: number | null = null;
let pollUntil = 0;

const REASONS: Record<OffReason, string> = {
  'master-off': 'The optimizer is turned off.',
  'unsupported-page': 'This kind of page cannot be optimized.',
  'builtin-protected': 'Sign-in, payment, CAPTCHA and local development sites are always left alone.',
  allowlisted: 'This site is on your skip list.',
  'essential-path': 'This page looks like a sign-in, checkout or payment step, so it is left alone.',
  'tab-paused': 'Paused on this tab. Resume to optimize again.',
  'compare-baseline': 'Measuring the unoptimized baseline.',
  'sensitive-input': 'A password, card field or CAPTCHA was detected, so optimization was switched off for safety.'
};

function notice(text: string | null, error = false): void {
  const n = $('notice');
  n.hidden = text === null;
  n.className = error ? 'notice error' : 'notice';
  n.textContent = text ?? '';
}

const host = (): string | null => view?.tab?.host ?? null;

function render(): void {
  if (!view) return;
  const { config, tab } = view;
  $('root').setAttribute('aria-busy', 'false');
  ($('master-toggle') as HTMLInputElement).checked = config.enabled;

  const h = host();
  $('domain-hostname').textContent = h ?? 'No optimizable page';
  const badge = $('domain-status-badge');
  const plan = tab?.plan;
  let label = 'UNAVAILABLE';
  let cls = 'status-badge bypassed';
  let detail = h ? '' : 'Browser pages, extension pages and local files cannot be optimized. If this is a normal website, reload it once.';
  if (plan) {
    if (plan.active) {
      label = 'OPTIMIZED';
      cls = 'status-badge active';
    } else {
      label = plan.reason === 'allowlisted' ? 'SKIPPED' : plan.reason === 'tab-paused' ? 'PAUSED' : 'OFF';
      detail = plan.reason ? REASONS[plan.reason] : '';
    }
  }
  if (tab?.bypass === 'safety') {
    label = 'OFF';
    cls = 'status-badge bypassed';
    detail = REASONS['sensitive-input'];
  }
  badge.textContent = label;
  badge.className = cls;
  $('status-detail').textContent = detail;

  const pause = $('btn-pause-tab') as HTMLButtonElement;
  const allow = $('btn-allow') as HTMLButtonElement;
  pause.disabled = !h;
  pause.textContent = tab?.bypass === 'user' ? 'Resume on this tab' : 'Pause on this tab';
  allow.disabled = !h;
  allow.textContent = h && config.allowlist.includes(h) ? 'Stop skipping' : 'Skip this site';

  renderModes(config);
  renderMetrics();
  renderCompare(tab?.compare ?? null);
  ($('btn-refresh') as HTMLButtonElement).disabled = !h;
  ($('btn-compare') as HTMLButtonElement).disabled = !h || !plan?.active || isComparing(tab?.compare ?? null);
  const w = view.warnings;
  if (w.length > 0 && $('notice').hidden) notice(w[0] as string);
}

function renderModes(config: Config): void {
  const h = host();
  const effective = resolveEffective(config, { protocol: 'https:', hostname: h ?? '', pathname: '/', hash: '', tabBypass: null }, null, 'start');
  const lvl = view?.tab?.sample?.level ?? null;
  $('active-mode-indicator').textContent =
    effective.mode === 'adaptive' ? `ADAPTIVE${lvl ? ' > ' + lvl.toUpperCase() : ''}` : effective.mode.toUpperCase();
  for (const b of document.querySelectorAll<HTMLButtonElement>('.mode-btn')) {
    const active = b.dataset.mode === effective.mode;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
    b.disabled = scope === 'site' && !h;
  }
  for (const input of document.querySelectorAll<HTMLInputElement>('input[data-module]')) {
    const name = input.dataset.module as ModuleName;
    input.checked = effective.modules[name];
    input.disabled = scope === 'site' && !h;
    if (name === 'network' && !view?.caps.dnr) {
      input.disabled = true;
      input.title = 'Network blocking is not supported by this browser.';
    }
  }
  const siteBtn = $('btn-reset-site');
  siteBtn.hidden = !(h && hasSiteOverride(config, h));
  $('scope-site').classList.toggle('active', scope === 'site');
  $('scope-all').classList.toggle('active', scope === 'all');
  $('scope-site').setAttribute('aria-pressed', String(scope === 'site'));
  $('scope-all').setAttribute('aria-pressed', String(scope === 'all'));
  $('mode-hint').textContent =
    effective.mode === 'adaptive'
      ? 'Adaptive starts from device and network signals the browser exposes, then may raise the level once after the page has loaded. It never lowers it.'
      : '';
}

function metricCard(label: string, m: Measurement<number>, unit: Parameters<typeof display>[1]): HTMLElement {
  const d = display(m, unit);
  return el('div', { class: 'metric-card', title: d.detail }, [
    el('span', { class: 'metric-label', text: label }),
    el('span', { class: d.badge === 'Unavailable' ? 'metric-value unavail' : 'metric-value', text: d.text }),
    el('span', { class: `meas ${d.badge.toLowerCase()}`, text: d.badge })
  ]);
}

function renderMetrics(): void {
  const grid = $('metrics');
  clear(grid);
  const t = view?.tab;
  if (!t) {
    grid.append(el('p', { class: 'hint', text: 'No page data yet.' }));
    return;
  }
  const s = t.sample;
  grid.append(metricCard('Blocked requests', t.blockedRequests, 'count'));
  if (!s) {
    grid.append(el('p', { class: 'hint', text: 'Press Refresh to measure this page.' }));
    return;
  }
  grid.append(
    metricCard('Requests recorded', s.requestCount, 'count'),
    metricCard('Transferred (visible)', s.transferredBytes, 'bytes'),
    metricCard('Load event', s.loadMs, 'ms'),
    metricCard('JS heap', s.jsHeapUsedMB, 'MB'),
    metricCard('Extension time', s.selfTimeMs, 'ms')
  );
  const a = s.actions;
  const parts: string[] = [];
  if (a.imagesLazy) parts.push(`${a.imagesLazy} images deferred`);
  if (a.videosAutoplayPaused + a.videosOffscreenPaused + a.videosBackgroundPaused)
    parts.push(`${a.videosAutoplayPaused + a.videosOffscreenPaused + a.videosBackgroundPaused} video pauses`);
  if (a.animationsPausedOffscreen) parts.push(`${a.animationsPausedOffscreen} animation pauses`);
  if (a.sectionsDeferred) parts.push(`${a.sectionsDeferred} sections deferred`);
  if (a.effectsReduced) parts.push('blur removed');
  const actions = el('p', { class: 'hint', text: `Actions taken: ${parts.length ? parts.join(', ') : 'none yet'}.` });
  actions.style.gridColumn = '1 / -1';
  grid.append(actions);
  if (s.selfLimited) {
    const n = el('p', { class: 'hint', text: 'The extension reached its own work budget on this page and stopped watching for changes.' });
    n.style.gridColumn = '1 / -1';
    grid.append(n);
  }
}

const isComparing = (c: CompareView | null) => !!c && (c.phase === 'baseline' || c.phase === 'optimized');

function renderCompare(c: CompareView | null): void {
  const out = $('compare-result');
  clear(out);
  const status = $('compare-status');
  if (!c) return;
  if (c.phase === 'baseline') status.textContent = 'Step 1 of 2: measuring without the optimizer...';
  else if (c.phase === 'optimized') status.textContent = 'Step 2 of 2: measuring with the optimizer...';
  else if (c.phase === 'failed') status.textContent = c.error ?? 'The measurement failed.';
  else status.textContent = 'Done. Single runs, so treat small differences as noise. A negative change means a lower number with the optimizer.';
  if (c.phase !== 'done' || !c.baseline || !c.optimized) return;
  const { rows, skipped } = compareSamples(c.baseline as PageSample, c.optimized as PageSample);
  const table = el('table', { class: 'cmp' }, [
    el('caption', { text: 'Without vs with optimizer' }),
    el('thead', {}, [el('tr', {}, ['Metric', 'Without', 'With', 'Change'].map((t) => el('th', { text: t })))])
  ]);
  const body = el('tbody');
  for (const r of rows) {
    const change = `${r.delta > 0 ? '+' : ''}${formatValue(r.delta, r.unit)}${r.deltaPct === null ? '' : ` (${r.deltaPct > 0 ? '+' : ''}${r.deltaPct}%)`}`;
    body.append(el('tr', {}, [r.label, formatValue(r.before, r.unit), formatValue(r.after, r.unit), change].map((t) => el('td', { text: t }))));
  }
  table.append(body);
  out.append(table);
  if (skipped.length > 0) {
    out.append(el('p', { class: 'hint', text: `Not compared: ${skipped.map((s) => `${s.label} (${s.reason})`).join('; ')}.` }));
  }
}

let lastBlocked: Measurement<number> | null = null;

/** `polling` avoids the rate-limited rule-match query and keeps the previous blocked count. */
async function refresh(polling = false): Promise<void> {
  const v = await getState(tabId, polling);
  if (!v) {
    notice('Could not reach the extension background. Reload the extension and try again.', true);
    $('root').setAttribute('aria-busy', 'false');
    return;
  }
  if (v.tab) {
    if (polling && lastBlocked) v.tab.blockedRequests = lastBlocked;
    else if (!polling) lastBlocked = v.tab.blockedRequests;
  }
  view = v;
  render();
}

async function save(next: Config): Promise<void> {
  const ack = await setConfig(next);
  if (!ack || !ack.ok) notice('Could not save the change.', true);
  else if (ack.issues && ack.issues.length > 0) notice(ack.issues[0] as string, true);
  else notice(null);
  await refresh();
}

function startPolling(): void {
  stopPolling();
  pollUntil = Date.now() + 60_000;
  pollTimer = window.setInterval(async () => {
    await refresh(true);
    if (!isComparing(view?.tab?.compare ?? null) || Date.now() > pollUntil) stopPolling();
  }, 1500);
}
function stopPolling(): void {
  if (pollTimer !== null) window.clearInterval(pollTimer);
  pollTimer = null;
}

async function act(button: HTMLButtonElement, msg: Record<string, unknown>): Promise<Ack | null> {
  setBusy(button, true);
  const ack = await request<Ack>(msg);
  setBusy(button, false);
  if (!ack || !ack.ok) notice(ack?.error ?? 'The action failed.', true);
  else notice(null);
  return ack;
}

function bind(): void {
  $('master-toggle').addEventListener('change', async (e) => {
    if (!view) return;
    await save({ ...view.config, enabled: (e.target as HTMLInputElement).checked });
  });
  for (const b of document.querySelectorAll<HTMLButtonElement>('.mode-btn')) {
    b.addEventListener('click', async () => {
      if (view) await save(setMode(view.config, scope, host(), b.dataset.mode as ModeSetting));
    });
  }
  for (const input of document.querySelectorAll<HTMLInputElement>('input[data-module]')) {
    input.addEventListener('change', async () => {
      if (view) await save(setModule(view.config, scope, host(), input.dataset.module as ModuleName, input.checked));
    });
  }
  $('scope-site').addEventListener('click', () => { scope = 'site'; render(); });
  $('scope-all').addEventListener('click', () => { scope = 'all'; render(); });
  $('btn-reset-site').addEventListener('click', async () => {
    const h = host();
    if (view && h) await save(resetSite(view.config, h));
  });
  $('btn-allow').addEventListener('click', async () => {
    const h = host();
    if (view && h) await save(toggleAllowlist(view.config, h));
  });
  $('btn-pause-tab').addEventListener('click', async (e) => {
    if (tabId === null || !view) return;
    const paused = view.tab?.bypass === 'user';
    await act(e.currentTarget as HTMLButtonElement, { type: paused ? 'TAB_RESUME' : 'TAB_PAUSE', tabId });
    await refresh();
  });
  $('btn-refresh').addEventListener('click', async (e) => {
    if (tabId === null) return;
    await act(e.currentTarget as HTMLButtonElement, { type: 'REQUEST_SAMPLE', tabId });
    await refresh();
  });
  $('btn-compare').addEventListener('click', async (e) => {
    if (tabId === null) return;
    const ack = await act(e.currentTarget as HTMLButtonElement, { type: 'COMPARE_START', tabId });
    if (ack?.ok) startPolling();
    await refresh();
  });
  $('btn-open-options').addEventListener('click', () => openOptions());
}

async function init(): Promise<void> {
  bind();
  tabId = await activeTabId();
  await refresh();
  if (isComparing(view?.tab?.compare ?? null)) startPolling();
}

window.addEventListener('pagehide', stopPolling);
void init();
