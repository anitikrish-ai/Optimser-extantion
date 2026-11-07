/**
 * Applies a NetworkPlan through the browser adapter. Calls are serialized so overlapping
 * configuration changes cannot interleave and leave rules in a mixed state.
 */
import type { Ext } from './ext';
import { ALL_RULESETS } from './network-plan';
import type { NetworkPlan } from './network-plan';

export interface ApplyResult {
  ok: boolean;
  /** Features that could not be applied in this browser. Shown to the user, never hidden. */
  warnings: string[];
}

export class NetworkApplier {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly ext: Ext) {}

  apply(plan: NetworkPlan): Promise<ApplyResult> {
    const run = this.chain.then(() => this.applyNow(plan));
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async applyNow(plan: NetworkPlan): Promise<ApplyResult> {
    const warnings: string[] = [];
    const { ext } = this;
    if (!ext.caps.dnr) {
      return { ok: false, warnings: ['Network blocking is not available in this browser (declarativeNetRequest missing).'] };
    }

    if (ext.caps.dnrRulesetToggle) {
      try {
        const enabled = new Set(await ext.getEnabledRulesets());
        const want = new Set<string>(plan.enableRulesets);
        const enable = [...want].filter((id) => !enabled.has(id));
        const disable = ALL_RULESETS.filter((id) => enabled.has(id) && !want.has(id));
        if (enable.length > 0 || disable.length > 0) await ext.updateEnabledRulesets(enable, disable);
      } catch (e) {
        warnings.push(`Could not update bundled rulesets: ${(e as Error).message}`);
      }
    } else {
      warnings.push('This browser cannot toggle bundled rulesets at runtime.');
    }

    if (ext.userRuleScope === 'none') {
      if (plan.userRules.length > 0) warnings.push('Custom rules and site exemptions are not supported in this browser.');
    } else {
      try {
        const existing = await ext.getUserRuleIds();
        await ext.replaceUserRules(existing, plan.userRules);
        if (ext.userRuleScope === 'dynamic') {
          warnings.push('Session rules are unavailable; using dynamic rules, which are cleared at every browser start.');
        }
      } catch (e) {
        warnings.push(`Could not update rules: ${(e as Error).message}`);
      }
    }
    return { ok: warnings.length === 0, warnings };
  }
}
