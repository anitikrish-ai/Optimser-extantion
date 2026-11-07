/**
 * Background state. Lives in storage.session (memory-backed, cleared when the browser closes,
 * survives service-worker restarts). When storage.session is unavailable it stays in memory only.
 *
 * What is kept: the configuration, and for each OPEN tab: hostname (not the URL), bypass flag,
 * the latest measurement sample and an optional before/after comparison.
 * Tab records are deleted when the tab closes. No browsing history is kept.
 */
import type { Ext } from '../adapters/ext';
import type { Config, Level, ModeSetting, OffReason } from '../shared/types';
import type { PageSample } from '../shared/measure';
import { cloneConfig, defaultConfig, sanitizeConfig } from '../shared/config';

export interface CompareState {
  runId: string;
  phase: 'baseline' | 'optimized' | 'done' | 'failed';
  baseline: PageSample | null;
  optimized: PageSample | null;
  error: string | null;
  startedAt: number;
}

export interface TabRecord {
  host: string | null;
  bypass: 'user' | 'compare' | 'safety' | null;
  plan: { active: boolean; reason: OffReason | null; mode: ModeSetting } | null;
  level: Level | null;
  sample: PageSample | null;
  compare: CompareState | null;
}

interface Persisted {
  config: Config;
  tabs: Record<string, TabRecord>;
}

const KEY = 'uwpo_session_state';

export const emptyTab = (): TabRecord => ({ host: null, bypass: null, plan: null, level: null, sample: null, compare: null });

export class BackgroundState {
  private config: Config = defaultConfig();
  private tabs = new Map<number, TabRecord>();
  private loading: Promise<void> | null = null;

  constructor(private readonly ext: Ext) {}

  /** Idempotent. Every handler awaits this first, so a cold-started worker never answers from empty state. */
  ready(): Promise<void> {
    if (!this.loading) this.loading = this.load();
    return this.loading;
  }

  private async load(): Promise<void> {
    const saved = await this.ext.storageGet<Persisted>(KEY);
    if (saved && typeof saved === 'object') {
      this.config = sanitizeConfig(saved.config).config;
      if (saved.tabs && typeof saved.tabs === 'object') {
        for (const [k, v] of Object.entries(saved.tabs)) {
          const id = Number(k);
          if (Number.isInteger(id) && v && typeof v === 'object') this.tabs.set(id, { ...emptyTab(), ...v });
        }
      }
    }
  }

  private async persist(): Promise<void> {
    const tabs: Record<string, TabRecord> = {};
    for (const [id, rec] of this.tabs) tabs[String(id)] = rec;
    await this.ext.storageSet(KEY, { config: this.config, tabs });
  }

  getConfig(): Config {
    return cloneConfig(this.config);
  }

  async setConfig(config: Config): Promise<void> {
    this.config = cloneConfig(config);
    await this.persist();
  }

  getTab(tabId: number): TabRecord | undefined {
    return this.tabs.get(tabId);
  }

  async updateTab(tabId: number, fn: (rec: TabRecord) => void): Promise<TabRecord> {
    const rec = this.tabs.get(tabId) ?? emptyTab();
    fn(rec);
    this.tabs.set(tabId, rec);
    await this.persist();
    return rec;
  }

  async deleteTab(tabId: number): Promise<boolean> {
    const had = this.tabs.delete(tabId);
    if (had) await this.persist();
    return had;
  }

  /** Tab ids whose requests must not be blocked (user pause, comparison baseline, safety trip). */
  bypassedTabIds(): number[] {
    const ids: number[] = [];
    for (const [id, rec] of this.tabs) if (rec.bypass) ids.push(id);
    return ids;
  }

  /** Drops all per-tab data (samples, comparisons, bypasses). Configuration is kept. */
  async clearTabs(): Promise<void> {
    this.tabs.clear();
    await this.persist();
  }

  /** Full reset: configuration back to defaults, all tab data and stored state erased. */
  async resetAll(): Promise<void> {
    this.tabs.clear();
    this.config = defaultConfig();
    await this.ext.storageClear();
    await this.persist();
  }
}
