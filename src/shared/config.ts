/**
 * Configuration defaults and sanitization.
 *
 * Every configuration that enters the system (UI message, imported file, storage read) passes through
 * sanitizeConfig(). Unknown keys are dropped, types are coerced to safe defaults, lists are bounded.
 */
import { MODE_SETTINGS, MODULE_NAMES } from './types';
import type { Config, ModeSetting, ModuleFlags, SiteOverride } from './types';
import { normalizeHostname } from '../safety/safety';
import { MAX_CUSTOM_RULES, validateCustomRule } from '../safety/custom-rules';

export const MAX_ALLOWLIST = 500;
export const MAX_SITE_OVERRIDES = 200;

export function defaultConfig(): Config {
  return {
    schema: 2,
    enabled: true,
    // Adaptive picks a level from measurable signals. Users who want fixed behaviour choose a level.
    mode: 'adaptive',
    modules: { network: true, images: true, videos: true, rendering: true, dom: true },
    network: { blockSessionReplay: true, blockAnalytics: true, blockAds: true, useCustomRules: true },
    images: { lazyLoading: true, asyncDecoding: true },
    videos: { blockAutoplay: true, pauseOffscreen: true, pauseInBackground: true },
    rendering: { pauseOffscreenAnimations: true, reduceEffects: true },
    dom: { contentVisibility: true },
    allowlist: [],
    customRules: [],
    sites: {}
  };
}

export const cloneConfig = (c: Config): Config => JSON.parse(JSON.stringify(c)) as Config;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const mode = (v: unknown, d: ModeSetting): ModeSetting =>
  typeof v === 'string' && (MODE_SETTINGS as readonly string[]).includes(v) ? (v as ModeSetting) : d;

export interface SanitizeResult {
  config: Config;
  /** Human-readable notes about anything that was dropped or corrected. */
  issues: string[];
}

export function sanitizeConfig(raw: unknown): SanitizeResult {
  const d = defaultConfig();
  const issues: string[] = [];
  if (!isObj(raw)) {
    if (raw !== undefined && raw !== null) issues.push('Configuration was not an object; defaults restored.');
    return { config: d, issues };
  }

  const modulesIn = isObj(raw.modules) ? raw.modules : {};
  const modules = {} as ModuleFlags;
  for (const k of MODULE_NAMES) modules[k] = bool(modulesIn[k], d.modules[k]);

  const net = isObj(raw.network) ? raw.network : {};
  const img = isObj(raw.images) ? raw.images : {};
  const vid = isObj(raw.videos) ? raw.videos : {};
  const ren = isObj(raw.rendering) ? raw.rendering : {};
  const dom = isObj(raw.dom) ? raw.dom : {};

  // Allowlist
  const allowlist: string[] = [];
  if (Array.isArray(raw.allowlist)) {
    for (const item of raw.allowlist) {
      const h = normalizeHostname(item);
      if (!h) {
        issues.push(`Ignored invalid allowlist entry.`);
        continue;
      }
      if (!allowlist.includes(h)) allowlist.push(h);
      if (allowlist.length >= MAX_ALLOWLIST) {
        issues.push(`Allowlist truncated to ${MAX_ALLOWLIST} entries.`);
        break;
      }
    }
  }

  // Custom rules
  const customRules: string[] = [];
  if (Array.isArray(raw.customRules)) {
    for (const item of raw.customRules) {
      const v = validateCustomRule(item);
      if (!v.ok) {
        issues.push(`Dropped custom rule: ${v.error}`);
        continue;
      }
      if (!customRules.includes(v.normalized)) customRules.push(v.normalized);
      if (customRules.length >= MAX_CUSTOM_RULES) {
        issues.push(`Custom rules truncated to ${MAX_CUSTOM_RULES}.`);
        break;
      }
    }
  }

  // Site overrides
  const sites: Record<string, SiteOverride> = {};
  if (isObj(raw.sites)) {
    let count = 0;
    for (const key of Object.keys(raw.sites)) {
      const host = normalizeHostname(key);
      const val = raw.sites[key];
      if (!host || !isObj(val)) {
        issues.push('Ignored invalid per-site entry.');
        continue;
      }
      if (count >= MAX_SITE_OVERRIDES) {
        issues.push(`Per-site settings truncated to ${MAX_SITE_OVERRIDES} entries.`);
        break;
      }
      const ov: SiteOverride = {};
      if (typeof val.mode === 'string' && (MODE_SETTINGS as readonly string[]).includes(val.mode)) {
        ov.mode = val.mode as ModeSetting;
      }
      if (isObj(val.modules)) {
        const m: Partial<ModuleFlags> = {};
        for (const k of MODULE_NAMES) {
          const flag = val.modules[k];
          if (typeof flag === 'boolean') m[k] = flag;
        }
        if (Object.keys(m).length > 0) ov.modules = m;
      }
      if (ov.mode !== undefined || ov.modules !== undefined) {
        sites[host] = ov;
        count++;
      }
    }
  }

  const config: Config = {
    schema: 2,
    enabled: bool(raw.enabled, d.enabled),
    mode: mode(raw.mode, d.mode),
    modules,
    network: {
      blockSessionReplay: bool(net.blockSessionReplay, d.network.blockSessionReplay),
      blockAnalytics: bool(net.blockAnalytics, d.network.blockAnalytics),
      blockAds: bool(net.blockAds, d.network.blockAds),
      useCustomRules: bool(net.useCustomRules, d.network.useCustomRules)
    },
    images: {
      lazyLoading: bool(img.lazyLoading, d.images.lazyLoading),
      asyncDecoding: bool(img.asyncDecoding, d.images.asyncDecoding)
    },
    videos: {
      blockAutoplay: bool(vid.blockAutoplay, d.videos.blockAutoplay),
      pauseOffscreen: bool(vid.pauseOffscreen, d.videos.pauseOffscreen),
      pauseInBackground: bool(vid.pauseInBackground, d.videos.pauseInBackground)
    },
    rendering: {
      pauseOffscreenAnimations: bool(ren.pauseOffscreenAnimations, d.rendering.pauseOffscreenAnimations),
      reduceEffects: bool(ren.reduceEffects, d.rendering.reduceEffects)
    },
    dom: { contentVisibility: bool(dom.contentVisibility, d.dom.contentVisibility) },
    allowlist,
    customRules,
    sites
  };
  return { config, issues };
}
