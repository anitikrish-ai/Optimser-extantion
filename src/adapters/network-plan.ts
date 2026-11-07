/**
 * Builds the desired network state (which bundled rulesets are on, which user rules exist)
 * from the configuration. Pure function; applying it is done by NetworkApplier.
 *
 * Priority ladder (higher wins):
 *   100  user allow  (allowlisted sites, built-in protected sites, per-tab bypass)
 *    10  essential allow (auth / payment / CAPTCHA providers) - bundled static ruleset
 *     5  custom block (user rules)
 *     1  bundled block (replay / analytics / ads)
 * So no user rule and no bundled list can ever block an essential provider, and the user can always
 * switch blocking off for a site or a tab.
 */
import type { Config } from '../shared/types';
import type { RulesetId } from '../shared/tracker-list';
import { ESSENTIAL_HOSTS, LOCAL_HOSTS, RULE_ID_BASE, RULE_PRIORITY } from '../shared/tracker-list';
import { compileCustomRules } from '../safety/custom-rules';
import type { DnrRule } from '../safety/custom-rules';

export const ALL_RULESETS: readonly RulesetId[] = ['replay', 'analytics', 'ads', 'essential'];

export interface NetworkPlan {
  enableRulesets: RulesetId[];
  userRules: DnrRule[];
}

const isDnrDomain = (h: string) => !h.startsWith('[') && h.length > 0;

export function buildNetworkPlan(config: Config, bypassedTabIds: readonly number[]): NetworkPlan {
  if (!config.enabled || !config.modules.network) return { enableRulesets: [], userRules: [] };

  const enable: RulesetId[] = [];
  if (config.network.blockSessionReplay) enable.push('replay');
  if (config.network.blockAnalytics) enable.push('analytics');
  if (config.network.blockAds) enable.push('ads');
  const anyBundled = enable.length > 0;
  if (anyBundled) enable.push('essential');

  const userRules: DnrRule[] = [];

  // Initiators that are exempt from every block rule.
  const exempt = new Set<string>();
  for (const h of config.allowlist) if (isDnrDomain(h)) exempt.add(h);
  for (const [host, ov] of Object.entries(config.sites)) {
    if (ov.modules?.network === false && isDnrDomain(host)) exempt.add(host);
  }
  for (const h of LOCAL_HOSTS) if (isDnrDomain(h)) exempt.add(h);
  // Only host-level entries: a path-scoped entry such as "google.com/recaptcha" must not exempt all of google.com.
  for (const e of ESSENTIAL_HOSTS) if (!e.includes('/')) exempt.add(e);
  if (exempt.size > 0) {
    userRules.push({
      id: RULE_ID_BASE.sessionAllowSites,
      priority: RULE_PRIORITY.userAllow,
      action: { type: 'allow' },
      condition: { initiatorDomains: [...exempt].sort() }
    });
  }

  const tabIds = [...new Set(bypassedTabIds)].filter((n) => Number.isInteger(n) && n >= 0);
  if (tabIds.length > 0) {
    userRules.push({
      id: RULE_ID_BASE.sessionAllowTabs,
      priority: RULE_PRIORITY.userAllow,
      action: { type: 'allow' },
      condition: { tabIds }
    });
  }

  if (config.network.useCustomRules) userRules.push(...compileCustomRules(config.customRules));

  return { enableRulesets: enable, userRules };
}
