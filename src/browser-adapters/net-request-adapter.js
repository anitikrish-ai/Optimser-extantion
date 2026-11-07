/**
 * Universal Website Performance Optimizer
 * Declarative Net Request Adapter
 * Safely manages dynamic network rules, domain exemptions, and custom block rules.
 */

import { browserApi } from './browser-api.js';
import { logger } from '../shared/logger.js';

export class NetRequestAdapter {
  constructor() {
    this.defaultRulesetId = 'default_performance_rules';
  }

  static getInstance() {
    if (!NetRequestAdapter.instance) {
      NetRequestAdapter.instance = new NetRequestAdapter();
    }
    return NetRequestAdapter.instance;
  }

  /**
   * Toggles the bundled static rule set globally
   */
  async setRulesetEnabled(enabled) {
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
   * domains are never blocked or interfered with (Priority: 100).
   */
  async updateDomainExemptions(allowlistedDomains) {
    if (!browserApi.hasDeclarativeNetRequest()) return;

    const api = browserApi.getApi();

    try {
      const existingRules = await new Promise((resolve) => {
        api.declarativeNetRequest.getDynamicRules((rules) => resolve(rules || []));
      });

      const existingExemptionRuleIds = existingRules
        .filter((r) => r.id >= 10000 && r.id < 20000)
        .map((r) => r.id);

      const cleanDomains = (allowlistedDomains || [])
        .map((d) => (d || '').toLowerCase().trim().replace(/^https?:\/\//, '').split('/')[0].split(':')[0])
        .filter((d) => d && d.length > 0);

      const newRules = cleanDomains.map((domain, index) => ({
        id: 10000 + index,
        priority: 100,
        action: { type: 'allow' },
        condition: {
          initiatorDomains: [domain],
          resourceTypes: [
            'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
            'font', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other'
          ]
        }
      }));

      await new Promise((resolve) => {
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

  /**
   * Adds dynamic custom block patterns specified by user (Priority: 20).
   * Custom rules now actually take effect at the network level!
   */
  async updateCustomRules(customBlockPatterns) {
    if (!browserApi.hasDeclarativeNetRequest()) return;

    const api = browserApi.getApi();

    try {
      const existingRules = await new Promise((resolve) => {
        api.declarativeNetRequest.getDynamicRules((rules) => resolve(rules || []));
      });

      const existingCustomRuleIds = existingRules
        .filter((r) => r.id >= 20000 && r.id < 30000)
        .map((r) => r.id);

      const patterns = (customBlockPatterns || [])
        .map((p) => (p || '').trim())
        .filter((p) => p.length > 0);

      const newRules = patterns.map((pattern, index) => ({
        id: 20000 + index,
        priority: 20,
        action: { type: 'block' },
        condition: {
          urlFilter: pattern.startsWith('||') ? pattern : `*${pattern}*`,
          resourceTypes: ['script', 'xmlhttprequest', 'ping', 'sub_frame', 'image', 'other']
        }
      }));

      await new Promise((resolve) => {
        api.declarativeNetRequest.updateDynamicRules(
          {
            removeRuleIds: existingCustomRuleIds,
            addRules: newRules
          },
          () => {
            if (api.runtime?.lastError) {
              logger.warn('Failed updating custom DNR rules:', api.runtime.lastError.message);
            } else {
              logger.info(`Updated custom DNR rules (${newRules.length} active)`);
            }
            resolve();
          }
        );
      });
    } catch (e) {
      logger.error('Failed configuring custom DNR rules:', e);
    }
  }

  /**
   * Completely clears all dynamic rules to ensure session-only cleanup
   * and disarm on emergency reset.
   */
  async clearDynamicRules() {
    if (!browserApi.hasDeclarativeNetRequest()) return;

    const api = browserApi.getApi();
    try {
      const existingRules = await new Promise((resolve) => {
        api.declarativeNetRequest.getDynamicRules((rules) => resolve(rules || []));
      });

      const allIds = existingRules.map((r) => r.id);
      if (allIds.length > 0) {
        await new Promise((resolve) => {
          api.declarativeNetRequest.updateDynamicRules({ removeRuleIds: allIds }, () => resolve());
        });
        logger.info(`Cleared all ${allIds.length} dynamic DNR rules.`);
      }
    } catch (e) {
      logger.error('Failed clearing dynamic DNR rules:', e);
    }
  }
}

export const netRequestAdapter = NetRequestAdapter.getInstance();

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.netRequestAdapter = netRequestAdapter;
  globalThis.UWPO.NetRequestAdapter = NetRequestAdapter;
}

