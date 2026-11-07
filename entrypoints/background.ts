/**
 * Universal Website Performance Optimizer
 * Background Service Worker Entrypoint
 * Handles cross-tab session orchestration, dynamic DNR rules, and tab lifecycle events.
 */

import { browserApi } from '../src/browser-adapters/browser-api';
import { netRequestAdapter } from '../src/browser-adapters/net-request-adapter';
import { sessionManager } from '../src/session/session-manager';
import { ExtensionMessage, OptimizerConfiguration, TabSessionState } from '../src/shared/types';
import { logger } from '../src/shared/logger';

// Initialize Declarative Net Request rules on extension load
(async () => {
  logger.info('Background Service Worker starting...');
  const config = sessionManager.getConfig();

  // Enable default static ruleset if master switch and network module are enabled
  const shouldEnableNetworkBlocking = config.masterEnabled && config.network.enabled;
  await netRequestAdapter.setRulesetEnabled(shouldEnableNetworkBlocking);

  // Apply default allowlist exemptions to DNR
  await netRequestAdapter.updateDomainExemptions(config.safety.allowlist);
  logger.info('DNR rules and allowlist exemptions configured.');
})();

// Central message dispatcher
const api = browserApi.getApi();

if (api.runtime?.onMessage) {
  api.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
    const tabId = sender.tab?.id ?? message.tabId;

    switch (message.action) {
      case 'GET_TAB_STATE': {
        const targetTabId = message.tabId || sender.tab?.id;
        if (targetTabId) {
          const state = sessionManager.getTabState(targetTabId);
          sendResponse({ success: true, state, config: sessionManager.getConfig() });
        } else {
          sendResponse({ success: false, config: sessionManager.getConfig() });
        }
        break;
      }

      case 'REPORT_PAGE_METRICS': {
        if (tabId && message.payload) {
          const payload = message.payload as Partial<TabSessionState>;
          sessionManager.updateTabState(tabId, payload);
          sendResponse({ success: true });
        }
        break;
      }

      case 'UPDATE_CONFIG': {
        if (message.payload) {
          const newConfig = message.payload as OptimizerConfiguration;
          sessionManager.setConfig(newConfig).then(async () => {
            // Update network blocking ruleset
            await netRequestAdapter.setRulesetEnabled(newConfig.masterEnabled && newConfig.network.enabled);
            await netRequestAdapter.updateDomainExemptions(newConfig.safety.allowlist);

            // Broadcast config update to active tab
            if (tabId) {
              await browserApi.sendTabMessage(tabId, { action: 'UPDATE_CONFIG', payload: newConfig });
            }
            sendResponse({ success: true });
          });
          return true; // Async response
        }
        break;
      }

      case 'EMERGENCY_RESET': {
        if (tabId) {
          browserApi.sendTabMessage(tabId, { action: 'EMERGENCY_RESET' }).then(() => {
            sendResponse({ success: true });
          });
          return true;
        }
        break;
      }

      case 'CLEAR_SESSION_STATE': {
        sessionManager.purgeAllSessionData().then(() => {
          sendResponse({ success: true });
        });
        return true;
      }

      default:
        sendResponse({ success: false, error: 'Unknown action' });
        break;
    }

    return true;
  });
}

