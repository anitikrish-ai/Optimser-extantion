/* eslint-disable @typescript-eslint/no-explicit-any */
import { Ext } from '../src/adapters/ext';
import { emptyActionCounts, measured, unavailable } from '../src/shared/measure';
import type { PageSample } from '../src/shared/measure';

export interface FakeOpts {
  dnr?: boolean;
  sessionRules?: boolean;
  sessionStorage?: boolean;
  matched?: Array<{ ruleId: number; rulesetId: string }> | 'throw';
}

/** A fake WebExtension API that records calls. storage.local deliberately throws: it must never be used. */
export function fakeApi(opts: FakeOpts = {}) {
  const o = { dnr: true, sessionRules: true, sessionStorage: true, ...opts };
  const log = {
    enabled: new Set<string>(['replay', 'analytics', 'ads', 'essential']),
    sessionRules: [] as any[],
    dynamicRules: [] as any[],
    tabMessages: [] as Array<{ id: number; msg: any }>,
    reloads: [] as Array<[number, any]>,
    storage: new Map<string, unknown>(),
    rulesetCalls: 0,
    ruleCalls: 0
  };
  const checkRules = (existing: any[], rm: number[] = [], add: any[] = []) => {
    const next = existing.filter((r) => !rm.includes(r.id));
    for (const r of add) {
      if (next.some((x) => x.id === r.id)) throw new Error(`duplicate rule id ${r.id}`);
      next.push(r);
    }
    return next;
  };
  const api: any = {
    runtime: { id: 'ext-id', getURL: (p: string) => `chrome-extension://ext-id/${p}`, sendMessage: async () => undefined, onMessage: { addListener() {} } },
    tabs: {
      query: async () => [{ id: 1 }, { id: 2 }, { id: 3 }],
      sendMessage: async (id: number, msg: any) => { log.tabMessages.push({ id, msg }); return { ok: true }; },
      reload: async (id: number, o: any) => { log.reloads.push([id, o]); }
    },
    storage: {
      local: { get() { throw new Error('storage.local must not be used'); }, set() { throw new Error('storage.local must not be used'); } }
    }
  };
  if (o.sessionStorage) {
    api.storage.session = {
      get: async (k: string) => (log.storage.has(k) ? { [k]: structuredClone(log.storage.get(k)) } : {}),
      set: async (obj: Record<string, unknown>) => { for (const [k, v] of Object.entries(obj)) log.storage.set(k, structuredClone(v)); },
      clear: async () => { log.storage.clear(); }
    };
  }
  if (o.dnr) {
    api.declarativeNetRequest = {
      getEnabledRulesets: async () => [...log.enabled],
      updateEnabledRulesets: async ({ enableRulesetIds, disableRulesetIds }: any) => {
        log.rulesetCalls++;
        enableRulesetIds.forEach((i: string) => log.enabled.add(i));
        disableRulesetIds.forEach((i: string) => log.enabled.delete(i));
      },
      updateDynamicRules: async ({ removeRuleIds, addRules }: any) => { log.ruleCalls++; log.dynamicRules = checkRules(log.dynamicRules, removeRuleIds, addRules); },
      getDynamicRules: async () => log.dynamicRules
    };
    if (o.sessionRules) {
      api.declarativeNetRequest.updateSessionRules = async ({ removeRuleIds, addRules }: any) => { log.ruleCalls++; log.sessionRules = checkRules(log.sessionRules, removeRuleIds, addRules); };
      api.declarativeNetRequest.getSessionRules = async () => log.sessionRules;
    }
    if (o.matched) {
      api.declarativeNetRequest.getMatchedRules = async () => {
        if (o.matched === 'throw') throw new Error('quota');
        return { rulesMatchedInfo: (o.matched as any[]).map((rule) => ({ rule })) };
      };
    }
  }
  return { api, log, ext: new Ext(api) };
}

export const sample = (over: Partial<PageSample> = {}): PageSample => ({
  takenAtEpochMs: 1, timeOriginEpochMs: 1, optimizerActive: true, level: 'balanced',
  ttfbMs: measured(10), domContentLoadedMs: measured(20), loadMs: measured(30), fcpMs: measured(15), lcpMs: unavailable('x'),
  requestCount: measured(5), transferredBytes: measured(1000), sizeHiddenResources: measured(2), domNodes: measured(100),
  longTaskCount: unavailable('x'), longTaskTotalMs: unavailable('x'), jsHeapUsedMB: unavailable('x'), selfTimeMs: measured(1),
  selfLimited: false, actions: emptyActionCounts(), ...over
});

