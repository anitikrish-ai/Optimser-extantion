/**
 * Universal Website Performance Optimizer
 * Declarative Net Request Adapter
 * Safely manages dynamic network rules and domain exemptions.
 */

import { browserApi } from './browser-api';
import { logger } from '../shared/logger';

export class NetRequestAdapter {
  private static instance: NetRequestAdapter;
  private readonly defaultRulesetId = 'default_performance_rules';

  private constructor() {}

  public static getInstance(): NetRequestAdapter {
    if (!NetRequestAdapter.instance) {
      NetRequestAdapter.instance = new NetRequestAdapter();
    }
    return NetRequestAdapter.instance;
  }

  /**
   * Toggles the bundled static rule set globally
   */
  public async setRulesetEnabled(enabled: boolean): Promise<boolean> {
    if (!browserApi.hasDeclarativeNetRequest()) {
      logger.warn('declarativeNetRequest API not supported in this runtime.');
      return false;
    }

    const api = browserApi.getApi();
    return new Promise((resolve) => {
      try {
        api.declarativeNetRequest.updateEnabledRulesets(
          {
            enableRulesetIds: enabled ? [this.defaultRulesetId] : [],
            disableRulesetIds: enabled ? [] : [this.defaultRulesetId]
          },
          () => {
            if (api.runtime?.lastError) {
              logger.error('Error toggling rulesets:', api.runtime.lastError.message);
              resolve(false);
            } else {
              logger.info(`Declarative Net Request ruleset ${this.defaultRulesetId} set to: ${enabled}`);
              resolve(true);
            }
          }
        );
      } catch (err) {
        logger.error('Exception in updateEnabledRulesets:', err);
        resolve(false);
      }
    });
  }

  /**
   * Adds dynamic domain allowlist rules so requests originating from allowlisted
   * domains are never blocked or interfered with.
   */
  public async updateDomainExemptions(allowlistedDomains: string[]): Promise<void> {
    if (!browserApi.hasDeclarativeNetRequest()) {
      return;
    }

    const api = browserApi.getApi();

    try {
      // Fetch existing dynamic rules to safely remove previous domain exemption rules
      const existingRules = await new Promise<chrome.declarativeNetRequest.Rule[]>((resolve) => {
        api.declarativeNetRequest.getDynamicRules((rules) => resolve(rules || []));
      });

      const existingExemptionRuleIds = existingRules
        .filter((r) => r.id >= 10000 && r.id < 20000)
        .map((r) => r.id);

      // Create allow rules with highest priority (priority: 100)
      const newRules: chrome.declarativeNetRequest.Rule[] = allowlistedDomains
        .filter((domain) => domain && domain.trim().length > 0)
        .map((domain, index) => ({
          id: 10000 + index,
          priority: 100,
          action: {
            type: 'allow' as chrome.declarativeNetRequest.RuleActionType.ALLOW
          },
          condition: {
            initiatorDomains: [domain.replace(/^https?:\/\//, '').split('/')[0]],
            resourceTypes: [
              'main_frame',
              'sub_frame',
              'stylesheet',
              'script',
              'image',
              'font',
              'xmlhttprequest',
              'ping',
              'media',
              'websocket',
              'other'
            ] as chrome.declarativeNetRequest.ResourceType[]
          }
        }));

      await new Promise<void>((resolve) => {
        api.declarativeNetRequest.updateDynamicRules(
          {
            removeRuleIds: existingExemptionRuleIds,
            addRules: newRules
          },
          () => {
            if (api.runtime?.lastError) {
              logger.warn('Failed updating dynamic exemption rules:', api.runtime.lastError.message);
            } else {
              logger.info(`Updated dynamic domain exemptions (${newRules.length} domains active)`);
            }
            resolve();
          }
        );
      });
    } catch (e) {
      logger.error('Failed configuring dynamic DNR rules:', e);
    }
  }
}

export const netRequestAdapter = NetRequestAdapter.getInstance();

