/**
 * Universal Website Performance Optimizer
 * Background Service Worker Entrypoint
 * Handles cross-tab session orchestration, dynamic DNR rules, and tab lifecycle events.
 */

import { browserApi } from '../src/browser-adapters/browser-api.js';
import { netRequestAdapter } from '../src/browser-adapters/net-request-adapter.js';
import { sessionManager } from '../src/session/session-manager.js';
import { logger } from '../src/shared/logger.js';

// Synchronize Declarative Net Request rules
async function syncDnrRules(config) {
  const shouldEnableNetworkBlocking = config.masterEnabled && config.network?.enabled && !config.safety?.emergencyDisabled;

  // 1. Static ruleset toggle
  await netRequestAdapter.setRulesetEnabled(shouldEnableNetworkBlocking);

  if (shouldEnableNetworkBlocking) {
    // 2. Allowlist domain exemptions (Priority 100)
    await netRequestAdapter.updateDomainExemptions(config.safety?.allowlist || []);

    // 3. Custom user block rules (Priority 20)
    await netRequestAdapter.updateCustomRules(config.network?.customBlockPatterns || []);
  } else {
    // Disarm dynamic rules on master disable or emergency stop
    await netRequestAdapter.clearDynamicRules();
  }
}

// Initialize on extension startup
(async () => {
  logger.info('Background Service Worker starting...');
  const config = sessionManager.getConfig();

  // Clear previous session dynamic rules to ensure session-only privacy
  await netRequestAdapter.clearDynamicRules();
  await syncDnrRules(config);

  logger.info('DNR rules and session configuration initialized.');
})();

// Central Message Dispatcher
const api = browserApi.getApi();

if (api.runtime?.onMessage) {
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabId = sender.tab?.id ?? message.tabId;

    switch (message.action) {
      case 'GET_TAB_STATE': {
        const targetTabId = message.tabId || sender.tab?.id;
        const config = sessionManager.getConfig();
        if (targetTabId) {
          const state = sessionManager.getTabState(targetTabId);
          sendResponse({ success: true, state, config });
        } else {
          sendResponse({ success: true, config });
        }
        break;
      }

      case 'REPORT_PAGE_METRICS': {
        if (tabId && message.payload) {
          sessionManager.updateTabState(tabId, message.payload);
          sendResponse({ success: true });
        }
        break;
      }

      case 'UPDATE_CONFIG': {
        if (message.payload) {
          const newConfig = message.payload;
          sessionManager.setConfig(newConfig).then(async () => {
            // Synchronize DNR network engine
            await syncDnrRules(newConfig);

            // Broadcast configuration update to ALL active browser tabs
            await browserApi.broadcastMessage({
              action: 'UPDATE_CONFIG',
              payload: newConfig
            });

            sendResponse({ success: true, config: newConfig });
          });
          return true; // Async response
        }
        break;
      }

      case 'EMERGENCY_RESET': {
        const targetTabId = message.tabId || sender.tab?.id;
        (async () => {
          // Disarm DNR rules immediately
          await netRequestAdapter.setRulesetEnabled(false);
          await netRequestAdapter.clearDynamicRules();

          // Dispatch emergency reset to the tab
          if (targetTabId) {
            await browserApi.sendTabMessage(targetTabId, { action: 'EMERGENCY_RESET' });
          }
          sendResponse({ success: true });
        })();
        return true;
      }

      case 'CLEAR_SESSION_STATE': {
        (async () => {
          await sessionManager.purgeAllSessionData();
          await netRequestAdapter.clearDynamicRules();
          await syncDnrRules(sessionManager.getConfig());
          sendResponse({ success: true });
        })();
        return true;
      }

      default:
        sendResponse({ success: false, error: 'Unknown action' });
        break;
    }

    return true;
  });
}
