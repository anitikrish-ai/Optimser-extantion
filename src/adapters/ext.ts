/**
 * Browser adapter.
 *
 * - Prefers the promise-based `browser` namespace (Firefox, Safari, recent Chromium) and falls back to `chrome`.
 * - Uses FEATURE DETECTION only. There is no user-agent sniffing anywhere in the extension.
 * - Every method degrades to a harmless result instead of throwing, so an unsupported API
 *   disables a feature instead of breaking the extension.
 *
 * The native API object is injected so the adapter can be tested with a fake.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyApi = any;

export interface Capabilities {
  /** declarativeNetRequest exists at all. */
  dnr: boolean;
  /** Rules can be scoped to the browser session (cleared on restart). */
  dnrSessionRules: boolean;
  /** Bundled static rulesets can be toggled at runtime. */
  dnrRulesetToggle: boolean;
  /** getMatchedRules is exposed (Chromium, needs activeTab or the feedback permission). */
  dnrMatchedRules: boolean;
  /** Blocked-request count on the toolbar badge (Chromium). */
  dnrBadgeCount: boolean;
  /** storage.session exists (memory-backed, cleared when the browser closes). */
  sessionStorage: boolean;
}

export interface TabLite {
  id: number;
}

export interface MessageSenderLite {
  id?: string;
  url?: string;
  frameId?: number;
  tab?: { id?: number };
}

export class Ext {
  readonly caps: Capabilities;

  constructor(private readonly api: AnyApi) {
    const dnr = api?.declarativeNetRequest;
    this.caps = {
      dnr: !!dnr,
      dnrSessionRules: !!dnr && typeof dnr.updateSessionRules === 'function',
      dnrRulesetToggle: !!dnr && typeof dnr.updateEnabledRulesets === 'function',
      dnrMatchedRules: !!dnr && typeof dnr.getMatchedRules === 'function',
      dnrBadgeCount: !!dnr && typeof dnr.setExtensionActionOptions === 'function',
      sessionStorage: !!api?.storage?.session
    };
  }

  static detect(g: AnyApi = globalThis): Ext | null {
    const api = g.browser?.runtime ? g.browser : g.chrome?.runtime ? g.chrome : null;
    return api ? new Ext(api) : null;
  }

  get runtimeId(): string | undefined {
    return this.api.runtime?.id;
  }

  getURL(path: string): string {
    return this.api.runtime.getURL(path);
  }

  get raw(): AnyApi {
    return this.api;
  }

  /** Resolves to undefined when there is no receiver or the call fails. Never throws. */
  async sendMessage<T = unknown>(message: unknown): Promise<T | undefined> {
    try {
      return (await this.api.runtime.sendMessage(message)) as T;
    } catch {
      return undefined;
    }
  }

  async sendTabMessage<T = unknown>(tabId: number, message: unknown): Promise<T | undefined> {
    try {
      return (await this.api.tabs.sendMessage(tabId, message)) as T;
    } catch {
      return undefined;
    }
  }

  async listTabIds(): Promise<number[]> {
    try {
      const tabs = (await this.api.tabs.query({})) as Array<{ id?: number }>;
      return tabs.map((t) => t.id).filter((id): id is number => typeof id === 'number');
    } catch {
      return [];
    }
  }

  async activeTabId(): Promise<number | null> {
    try {
      const tabs = (await this.api.tabs.query({ active: true, currentWindow: true })) as Array<{ id?: number }>;
      const id = tabs[0]?.id;
      return typeof id === 'number' ? id : null;
    } catch {
      return null;
    }
  }

  async reloadTab(tabId: number, bypassCache: boolean): Promise<boolean> {
    try {
      await this.api.tabs.reload(tabId, { bypassCache });
      return true;
    } catch {
      return false;
    }
  }

  // ---- declarativeNetRequest ----

  async getEnabledRulesets(): Promise<string[]> {
    if (!this.caps.dnrRulesetToggle) return [];
    try {
      return (await this.api.declarativeNetRequest.getEnabledRulesets()) as string[];
    } catch {
      return [];
    }
  }

  async updateEnabledRulesets(enable: string[], disable: string[]): Promise<void> {
    await this.api.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: enable,
      disableRulesetIds: disable
    });
  }

  /** Which rule scope is used for user-specific rules. Session is preferred because it never outlives the browser. */
  get userRuleScope(): 'session' | 'dynamic' | 'none' {
    if (this.caps.dnrSessionRules) return 'session';
    if (this.caps.dnr && typeof this.api.declarativeNetRequest.updateDynamicRules === 'function') return 'dynamic';
    return 'none';
  }

  async getUserRuleIds(): Promise<number[]> {
    const scope = this.userRuleScope;
    if (scope === 'none') return [];
    const dnr = this.api.declarativeNetRequest;
    try {
      const rules = (await (scope === 'session' ? dnr.getSessionRules() : dnr.getDynamicRules())) as Array<{ id: number }>;
      return rules.map((r) => r.id);
    } catch {
      return [];
    }
  }

  async replaceUserRules(removeIds: number[], addRules: unknown[]): Promise<void> {
    const scope = this.userRuleScope;
    if (scope === 'none') return;
    const dnr = this.api.declarativeNetRequest;
    const opts = { removeRuleIds: removeIds, addRules };
    if (scope === 'session') await dnr.updateSessionRules(opts);
    else await dnr.updateDynamicRules(opts);
  }

  async getMatchedRules(tabId: number, minTimeStamp?: number): Promise<Array<{ ruleId: number; rulesetId: string }> | null> {
    if (!this.caps.dnrMatchedRules) return null;
    try {
      const filter: { tabId: number; minTimeStamp?: number } = { tabId };
      if (typeof minTimeStamp === 'number') filter.minTimeStamp = minTimeStamp;
      const res = (await this.api.declarativeNetRequest.getMatchedRules(filter)) as {
        rulesMatchedInfo?: Array<{ rule: { ruleId: number; rulesetId: string } }>;
      };
      return (res?.rulesMatchedInfo ?? []).map((i) => i.rule);
    } catch {
      // Quota exceeded or activeTab not granted for this tab.
      return null;
    }
  }

  async enableBadgeCount(): Promise<void> {
    if (!this.caps.dnrBadgeCount) return;
    try {
      await this.api.declarativeNetRequest.setExtensionActionOptions({ displayActionCountAsBadgeText: true });
    } catch {
      /* optional feature */
    }
  }

  // ---- session storage ----

  async storageGet<T>(key: string): Promise<T | undefined> {
    const area = this.api.storage?.session;
    if (!area) return undefined;
    try {
      const res = (await area.get(key)) as Record<string, T>;
      return res?.[key];
    } catch {
      return undefined;
    }
  }

  async storageSet(key: string, value: unknown): Promise<void> {
    const area = this.api.storage?.session;
    if (!area) return;
    try {
      await area.set({ [key]: value });
    } catch {
      /* quota or unsupported: state stays in memory */
    }
  }

  async storageClear(): Promise<void> {
    const area = this.api.storage?.session;
    if (!area) return;
    try {
      await area.clear();
    } catch {
      /* ignore */
    }
  }
}
