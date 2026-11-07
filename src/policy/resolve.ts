/**
 * Configuration precedence, in one pure function:
 *
 *   1. Global settings        (Config.mode / Config.modules / options)
 *   2. Site-specific override (Config.sites, most specific hostname wins)
 *   3. Adaptive engine        (only chooses an intensity Level; never enables a module the user turned off)
 *   4. Safety overrides       (master switch, built-in protection, allowlist, essential flows, tab pause,
 *                              sensitive inputs). Safety is applied last and always wins.
 */
import type { Config, ContentSettings, Level, ModeSetting, ModuleFlags, OffReason, Plan } from '../shared/types';
import { decideLevel } from '../adaptive/decide';
import type { Signals, Phase } from '../adaptive/decide';
import { hostMatches, isAllowlisted, isBuiltinProtectedHost, isEssentialPath } from '../safety/safety';

export interface PageContext {
  protocol: string;
  hostname: string;
  pathname: string;
  hash: string;
  /**
   * Set by the background: the user paused this tab, a comparison baseline is running,
   * or the content script tripped a safety check earlier on this host.
   */
  tabBypass: 'user' | 'compare' | 'safety' | null;
}

export interface Flags {
  /** Content script saw credential/payment/CAPTCHA elements on the page. */
  sensitiveInput?: boolean;
}

export interface Effective {
  active: boolean;
  reason: OffReason | null;
  mode: ModeSetting;
  /** Null when the adaptive engine has no signals yet (content script resolves it later). */
  level: Level | null;
  modules: ModuleFlags;
  settings: ContentSettings;
  trace: string[];
}

/** Most specific (longest) matching per-site override. */
export function findSiteKey(config: Config, hostname: string): string | null {
  let best: string | null = null;
  for (const key of Object.keys(config.sites)) {
    if (hostMatches(hostname, key) && (best === null || key.length > best.length)) best = key;
  }
  return best;
}

export function buildContentSettings(config: Config, modules: ModuleFlags): ContentSettings {
  return {
    images: { enabled: modules.images, ...config.images },
    videos: { enabled: modules.videos, ...config.videos },
    rendering: { enabled: modules.rendering, ...config.rendering },
    dom: { enabled: modules.dom, ...config.dom }
  };
}

export function resolveEffective(
  config: Config,
  ctx: PageContext,
  signals: Signals | null,
  phase: Phase,
  flags: Flags = {}
): Effective {
  const trace: string[] = [];

  // 1. Global
  let mode: ModeSetting = config.mode;
  let modules: ModuleFlags = { ...config.modules };
  trace.push(`global: mode=${mode}`);

  // 2. Site override
  const siteKey = findSiteKey(config, ctx.hostname);
  if (siteKey) {
    const ov = config.sites[siteKey];
    if (ov) {
      if (ov.mode) mode = ov.mode;
      if (ov.modules) modules = { ...modules, ...ov.modules };
      trace.push(`site override (${siteKey}): mode=${mode}`);
    }
  }

  // 3. Adaptive
  let level: Level | null;
  if (mode === 'adaptive') {
    level = signals ? decideLevel(signals, phase).level : null;
    trace.push(`adaptive: level=${level ?? 'pending'}`);
  } else {
    level = mode;
  }

  // 4. Safety (highest precedence)
  let reason: OffReason | null = null;
  if (!config.enabled) reason = 'master-off';
  else if (ctx.protocol !== 'http:' && ctx.protocol !== 'https:') reason = 'unsupported-page';
  else if (isBuiltinProtectedHost(ctx.hostname)) reason = 'builtin-protected';
  else if (isAllowlisted(ctx.hostname, config.allowlist)) reason = 'allowlisted';
  else if (isEssentialPath(ctx.pathname, ctx.hash)) reason = 'essential-path';
  else if (ctx.tabBypass === 'user') reason = 'tab-paused';
  else if (ctx.tabBypass === 'compare') reason = 'compare-baseline';
  else if (ctx.tabBypass === 'safety' || flags.sensitiveInput) reason = 'sensitive-input';
  if (reason) trace.push(`safety: off (${reason})`);

  return {
    active: reason === null,
    reason,
    mode,
    level,
    modules,
    settings: buildContentSettings(config, modules),
    trace
  };
}

export function toPlan(e: Effective, autoSampleWanted: Plan['autoSample'], runId: string | null): Plan {
  return {
    active: e.active,
    reason: e.reason,
    mode: e.mode,
    settings: e.settings,
    autoSample: autoSampleWanted,
    runId
  };
}
