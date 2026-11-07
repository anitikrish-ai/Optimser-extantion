/**
 * Request handlers. Each handler is independent of the transport so it can be tested with fakes.
 */
import type { Ext } from '../adapters/ext';
import type { NetworkApplier } from '../adapters/network-applier';
import { buildNetworkPlan } from '../adapters/network-plan';
import type { BackgroundState, CompareState } from './state';
import { sanitizeConfig } from '../shared/config';
import { normalizeHostname } from '../safety/safety';
import { resolveEffective, toPlan } from '../policy/resolve';
import type { PageContext } from '../policy/resolve';
import type { Plan } from '../shared/types';
import type { PageSample } from '../shared/measure';
import { measured, unavailable } from '../shared/measure';
import { sanitizeSample } from '../shared/messages';
import type { Ack, ContentCommand, StateView, TabView } from '../shared/messages';
import { RULE_ID_BASE } from '../shared/tracker-list';

export interface Deps {
  ext: Ext;
  state: BackgroundState;
  applier: NetworkApplier;
}

const newRunId = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export class Handlers {
  /** Warnings from the most recent network apply, surfaced in the UI instead of being hidden. */
  private warnings: string[] = [];

  constructor(private readonly d: Deps) {}

  // ---------- network ----------

  async reconcileNetwork(): Promise<void> {
    const { state, applier } = this.d;
    await state.ready();
    const res = await applier.apply(buildNetworkPlan(state.getConfig(), state.bypassedTabIds()));
    this.warnings = res.warnings;
  }

  private async command(tabId: number, cmd: ContentCommand): Promise<void> {
    await this.d.ext.sendTabMessage(tabId, cmd);
  }

  private async broadcastPlanChanged(): Promise<void> {
    const ids = await this.d.ext.listTabIds();
    await Promise.all(ids.map((id) => this.command(id, { type: 'PLAN_CHANGED' })));
  }

  // ---------- content script requests ----------

  async getPlan(tabId: number, senderUrl: string | undefined): Promise<Plan> {
    const { state } = this.d;
    await state.ready();
    const config = state.getConfig();

    let url: URL | null = null;
    try {
      url = senderUrl ? new URL(senderUrl) : null;
    } catch {
      url = null;
    }
    const host = url ? normalizeHostname(url.hostname) : null;
    const rec = state.getTab(tabId);

    // Navigating to a different host drops any tab-scoped bypass (fail open, then restore blocking).
    let needsNetworkSync = false;
    if (rec && rec.bypass && rec.host !== host) {
      const comparing = rec.bypass === 'compare';
      await state.updateTab(tabId, (r) => {
        r.bypass = null;
        if (comparing && r.compare && (r.compare.phase === 'baseline' || r.compare.phase === 'optimized')) {
          r.compare.phase = 'failed';
          r.compare.error = 'The tab navigated to a different site during the measurement.';
        }
      });
      needsNetworkSync = true;
    }
    if (needsNetworkSync) await this.reconcileNetwork();

    const ctx: PageContext = {
      protocol: url?.protocol ?? '',
      hostname: host ?? '',
      pathname: url?.pathname ?? '',
      hash: url?.hash ?? '',
      tabBypass: state.getTab(tabId)?.bypass ?? null
    };
    const eff = resolveEffective(config, ctx, null, 'start');

    const current = state.getTab(tabId);
    const comparing = current?.compare && (current.compare.phase === 'baseline' || current.compare.phase === 'optimized');
    let autoSample: Plan['autoSample'] = 'none';
    let runId: string | null = null;
    if (comparing && current?.compare) {
      autoSample = 'compare';
      runId = current.compare.runId;
      if (current.compare.phase === 'optimized' && !eff.active) {
        await state.updateTab(tabId, (r) => {
          if (r.compare) {
            r.compare.phase = 'failed';
            r.compare.error = `The optimizer is not active on this page (${eff.reason ?? 'unknown'}), so there is nothing to compare.`;
          }
        });
        autoSample = 'none';
        runId = null;
      }
    } else if (eff.active && eff.mode === 'adaptive') {
      autoSample = 'adaptive';
    }

    await state.updateTab(tabId, (r) => {
      r.host = host;
      r.plan = { active: eff.active, reason: eff.reason, mode: eff.mode };
      r.level = eff.level;
      r.sample = null;
    });
    return toPlan(eff, autoSample, runId);
  }

  async reportSample(tabId: number, sample: PageSample, runId: string | null): Promise<Ack> {
    const { state } = this.d;
    await state.ready();
    let reload = false;
    await state.updateTab(tabId, (r) => {
      r.sample = sample;
      r.level = sample.level;
      const c = r.compare;
      if (!c || c.runId !== runId) return;
      if (c.phase === 'baseline') {
        if (sample.optimizerActive) {
          c.phase = 'failed';
          c.error = 'Baseline run was not unoptimized; comparison discarded.';
          r.bypass = null;
          return;
        }
        c.baseline = sample;
        c.phase = 'optimized';
        r.bypass = null;
        reload = true;
      } else if (c.phase === 'optimized') {
        if (!sample.optimizerActive) {
          c.phase = 'failed';
          c.error = 'Optimized run was not optimized; comparison discarded.';
          return;
        }
        c.optimized = sample;
        c.phase = 'done';
      }
    });
    if (reload) {
      await this.reconcileNetwork();
      await this.d.ext.reloadTab(tabId, true);
    } else if (state.getTab(tabId)?.compare?.phase === 'failed') {
      await this.reconcileNetwork();
    }
    return { ok: true };
  }

  async safetyTrip(tabId: number): Promise<Ack> {
    const { state } = this.d;
    await state.ready();
    const rec = state.getTab(tabId);
    if (!rec || rec.bypass === 'user' || rec.bypass === 'compare') return { ok: true };
    await state.updateTab(tabId, (r) => {
      r.bypass = 'safety';
      r.plan = r.plan ? { ...r.plan, active: false, reason: 'sensitive-input' } : r.plan;
    });
    await this.reconcileNetwork();
    return { ok: true };
  }

  // ---------- extension page requests ----------

  async setConfig(raw: unknown): Promise<Ack & { config?: unknown }> {
    const { state } = this.d;
    await state.ready();
    const { config, issues } = sanitizeConfig(raw);
    await state.setConfig(config);
    await this.reconcileNetwork();
    await this.broadcastPlanChanged();
    return { ok: true, issues, warnings: this.warnings };
  }

  async tabPause(tabId: number): Promise<Ack> {
    const { state, ext } = this.d;
    await state.ready();
    if (!state.getTab(tabId)?.host) return { ok: false, error: 'This page cannot be optimized, so there is nothing to pause.' };
    await state.updateTab(tabId, (r) => {
      r.bypass = 'user';
      r.compare = null;
    });
    await this.reconcileNetwork();
    await this.command(tabId, { type: 'RESTORE_NOW' });
    await ext.reloadTab(tabId, false);
    return { ok: true, warnings: this.warnings };
  }

  async tabResume(tabId: number): Promise<Ack> {
    const { state, ext } = this.d;
    await state.ready();
    await state.updateTab(tabId, (r) => {
      r.bypass = null;
    });
    await this.reconcileNetwork();
    await ext.reloadTab(tabId, false);
    return { ok: true };
  }

  async compareStart(tabId: number): Promise<Ack> {
    const { state, ext } = this.d;
    await state.ready();
    const rec = state.getTab(tabId);
    if (!rec?.host) return { ok: false, error: 'This page cannot be measured.' };
    if (!rec.plan?.active) return { ok: false, error: 'The optimizer is not active on this page, so there is nothing to compare.' };
    const compare: CompareState = {
      runId: newRunId(),
      phase: 'baseline',
      baseline: null,
      optimized: null,
      error: null,
      startedAt: Date.now()
    };
    await state.updateTab(tabId, (r) => {
      r.compare = compare;
      r.bypass = 'compare';
    });
    await this.reconcileNetwork();
    const ok = await ext.reloadTab(tabId, true);
    if (!ok) {
      await state.updateTab(tabId, (r) => {
        r.compare = null;
        r.bypass = null;
      });
      await this.reconcileNetwork();
      return { ok: false, error: 'Could not reload the tab.' };
    }
    return { ok: true };
  }

  async compareCancel(tabId: number): Promise<Ack> {
    const { state } = this.d;
    await state.ready();
    await state.updateTab(tabId, (r) => {
      r.compare = null;
      if (r.bypass === 'compare') r.bypass = null;
    });
    await this.reconcileNetwork();
    return { ok: true };
  }

  async requestSample(tabId: number): Promise<Ack & { sample?: PageSample | null }> {
    const { state, ext } = this.d;
    await state.ready();
    const raw = await ext.sendTabMessage<{ sample?: unknown }>(tabId, { type: 'SAMPLE_NOW' } satisfies ContentCommand);
    const sample = raw?.sample ? sanitizeSample(raw.sample) : null;
    if (sample) await state.updateTab(tabId, (r) => { r.sample = sample; r.level = sample.level; });
    return { ok: !!sample, sample, error: sample ? undefined : 'The page did not respond. Reload it and try again.' };
  }

  async getState(tabId: number | null, skipBlocked = false): Promise<StateView> {
    const { state, ext } = this.d;
    await state.ready();
    let tab: TabView | null = null;
    if (tabId !== null) {
      const rec = state.getTab(tabId);
      if (rec) {
        tab = {
          tabId,
          host: rec.host,
          plan: rec.plan,
          bypass: rec.bypass,
          sample: rec.sample,
          compare: rec.compare,
          blockedRequests: skipBlocked
            ? unavailable<number>('Not refreshed during polling')
            : await this.blockedCount(tabId, rec.sample?.timeOriginEpochMs)
        };
      }
    }
    return { config: state.getConfig(), caps: ext.caps, warnings: this.warnings, tab };
  }

  /** Blocked requests are counted from the browser's own rule-match records, never estimated. */
  private async blockedCount(tabId: number, since?: number) {
    const { ext } = this.d;
    if (!ext.caps.dnrMatchedRules) return unavailable<number>('This browser does not expose rule match information.');
    const rules = await ext.getMatchedRules(tabId, since);
    if (rules === null) return unavailable<number>('Not available right now (browser quota or permission).');
    const n = rules.filter(
      (r) => (r.ruleId >= RULE_ID_BASE.sessionCustomBase && r.ruleId < 200) || (r.ruleId >= RULE_ID_BASE.replay && r.ruleId < RULE_ID_BASE.essential)
    ).length;
    return measured(n, 'Rule matches recorded by the browser since this page loaded.');
  }

  async clearSession(): Promise<Ack> {
    const { state } = this.d;
    await state.ready();
    await state.clearTabs();
    await this.reconcileNetwork();
    await this.broadcastPlanChanged();
    return { ok: true };
  }

  async resetAll(): Promise<Ack> {
    const { state } = this.d;
    await state.ready();
    await state.resetAll();
    await this.reconcileNetwork();
    await this.broadcastPlanChanged();
    return { ok: true };
  }

  async onTabRemoved(tabId: number): Promise<void> {
    const { state } = this.d;
    await state.ready();
    const had = state.getTab(tabId);
    if (!had) return;
    await state.deleteTab(tabId);
    if (had.bypass) await this.reconcileNetwork();
  }
}
