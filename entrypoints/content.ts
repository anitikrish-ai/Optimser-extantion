/**
 * Universal Website Performance Optimizer
 * Content Script Entrypoint
 * Bootstraps Optimizer Core on the webpage, manages runtime messaging, and lifecycle teardowns.
 */

import { optimizerCore } from '../src/core/optimizer-core';
import { browserApi } from '../src/browser-adapters/browser-api';
import { ExtensionMessage, OptimizerConfiguration } from '../src/shared/types';
import { DEFAULT_CONFIG } from '../src/shared/constants';
import { logger } from '../src/shared/logger';

(async () => {
  logger.info('Performance Optimizer Content Script engaged.');

  // Fetch session configuration from background service worker
  const response = await browserApi.sendMessage<{ action: string }, { success: boolean; config?: OptimizerConfiguration }>({
    action: 'GET_TAB_STATE'
  });

  const config = response?.config || DEFAULT_CONFIG;

  // Initialize optimizer core on this webpage
  optimizerCore.init(config);

  // Listen for real-time control messages from Popup or Background
  const api = browserApi.getApi();
  if (api.runtime?.onMessage) {
    api.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
      switch (message.action) {
        case 'EMERGENCY_RESET':
          optimizerCore.emergencyReset();
          sendResponse({ success: true });
          break;

        case 'UPDATE_CONFIG':
          if (message.payload) {
            optimizerCore.updateConfig(message.payload as OptimizerConfiguration);
            sendResponse({ success: true });
          }
          break;

        default:
          break;
      }
      return true;
    });
  }
})();

