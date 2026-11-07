/**
 * Pure configuration edits used by the popup and dashboard. Returning a new Config (never mutating)
 * keeps UI logic testable and makes "scope" (all sites vs this site) explicit.
 */
import type { Config, ModeSetting, ModuleName, SiteOverride } from '../shared/types';
import { cloneConfig } from '../shared/config';
import { normalizeHostname } from '../safety/safety';

export type Scope = 'all' | 'site';

function site(c: Config, host: string): SiteOverride {
  const existing = Object.prototype.hasOwnProperty.call(c.sites, host) ? c.sites[host] : undefined;
  const ov: SiteOverride = existing ?? {};
  c.sites[host] = ov;
  return ov;
}

function prune(c: Config, host: string): void {
  const ov = c.sites[host];
  if (!ov) return;
  if (ov.modules && Object.keys(ov.modules).length === 0) delete ov.modules;
  if (ov.mode === undefined && ov.modules === undefined) delete c.sites[host];
}

export function setMode(config: Config, scope: Scope, host: string | null, mode: ModeSetting): Config {
  const c = cloneConfig(config);
  if (scope === 'all' || !host) {
    c.mode = mode;
  } else {
    site(c, host).mode = mode;
  }
  return c;
}

export function setModule(config: Config, scope: Scope, host: string | null, name: ModuleName, value: boolean): Config {
  const c = cloneConfig(config);
  if (scope === 'all' || !host) {
    c.modules[name] = value;
  } else {
    const ov = site(c, host);
    ov.modules = { ...(ov.modules ?? {}), [name]: value };
  }
  return c;
}

export function resetSite(config: Config, host: string): Config {
  const c = cloneConfig(config);
  delete c.sites[host];
  return c;
}

export function toggleAllowlist(config: Config, host: string): Config {
  const c = cloneConfig(config);
  const h = normalizeHostname(host);
  if (!h) return c;
  c.allowlist = c.allowlist.includes(h) ? c.allowlist.filter((x) => x !== h) : [...c.allowlist, h];
  return c;
}

export const hasSiteOverride = (config: Config, host: string): boolean =>
  Object.prototype.hasOwnProperty.call(config.sites, host);
