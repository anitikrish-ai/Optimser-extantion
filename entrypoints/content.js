/**
 * Universal Website Performance Optimizer
 * Content Script Entrypoint
 * Bootstraps Optimizer Core on the webpage, manages runtime messaging, and lifecycle teardowns.
 */

(async () => {
  const core = (typeof globalThis !== 'undefined' && globalThis.UWPO?.optimizerCore)
    ? globalThis.UWPO.optimizerCore
    : null;

  if (!core) {
    console.warn('[UWPO Content] OptimizerCore not loaded.');
    return;
  }

  // Fetch session configuration from background service worker
  const api = (typeof globalThis !== 'undefined' && globalThis.UWPO?.browserApi)
    ? globalThis.UWPO.browserApi
    : null;

  const defaultCfg = (typeof globalThis !== 'undefined' && globalThis.UWPO?.DEFAULT_CONFIG)
    ? globalThis.UWPO.DEFAULT_CONFIG
    : {};

  let config = defaultCfg;

  if (api) {
    const response = await api.sendMessage({ action: 'GET_TAB_STATE' });
    if (response?.config) {
      config = response.config;
    }
  }

  // Initialize optimizer core on this webpage
  core.init(config);

  // Listen for real-time control messages from Popup or Background
  const rawApi = typeof chrome !== 'undefined' && chrome.runtime ? chrome : null;
  if (rawApi?.runtime?.onMessage) {
    rawApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      switch (message.action) {
        case 'EMERGENCY_RESET':
          core.emergencyReset();
          sendResponse({ success: true });
          break;

        case 'UPDATE_CONFIG':
          if (message.payload) {
            core.updateConfig(message.payload);
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
