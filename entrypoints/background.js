/**
 * Universal Website Performance Optimizer
 * Standalone Background Service Worker
 * Native WebExtension MV3 Module
 */

const DEFAULT_CONFIG = {
  masterEnabled: true,
  mode: 'balanced',
  autoAdaptive: true,
  cpu: {
    enabled: true,
    throttleBackgroundTimers: true,
    throttleScrollEvents: true,
    pauseOffscreenCanvases: true,
    maxBackgroundIntervalMs: 1000
  },
  memory: {
    enabled: true,
    enableWeakRefTracking: true,
    cleanDetachedDomNodes: true,
    teardownOnUnload: true,
    periodicCleanupIntervalSec: 60
  },
  scripts: {
    enabled: true,
    blockHeavyTrackers: true,
    blockSessionReplay: true,
    blockTelemetryBeacons: true,
    protectEssentialScripts: true
  },
  images: {
    enabled: true,
    enforceLazyLoading: true,
    enforceAsyncDecoding: true,
    deferOffscreenImages: true,
    pauseAnimatedGifsOffscreen: true
  },
  videos: {
    enabled: true,
    blockAutoplay: true,
    pauseOffscreenVideos: true,
    pauseBackgroundTabVideos: true,
    suppressVideoPreviews: true
  },
  rendering: {
    enabled: true,
    reduceCssAnimations: true,
    disableExpensiveFilters: true,
    disableBackdropBlur: true,
    disableHeavyBoxShadows: false,
    enforceReducedMotion: true
  },
  network: {
    enabled: true,
    blockKnownAdNetworks: true,
    blockTrackingPixels: true,
    blockThirdPartyFontsOnSlowNetwork: false,
    customBlockPatterns: []
  },
  dom: {
    enabled: true,
    enableContentVisibilityAuto: true,
    batchMutationObservers: true,
    throttleSubtreeScans: true
  },
  safety: {
    allowlist: [
      'localhost',
      '127.0.0.1',
      'accounts.google.com',
      'login.microsoftonline.com',
      'appleid.apple.com',
      'github.com/login',
      'gitlab.com/users/sign_in',
      'auth0.com',
      'checkout.stripe.com',
      'paypal.com',
      'pay.google.com'
    ],
    emergencyDisabled: false,
    protectPaymentAndAuth: true
  }
};

const tabStates = new Map();
let activeConfig = { ...DEFAULT_CONFIG };

// Load session config if exists
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
  chrome.storage.session.get(['uwpo_config_session'], (res) => {
    if (res && res.uwpo_config_session) {
      activeConfig = res.uwpo_config_session;
    }
    syncDnrRules();
  });
} else {
  syncDnrRules();
}

// Synchronize Declarative Net Request rules
function syncDnrRules() {
  if (typeof chrome === 'undefined' || !chrome.declarativeNetRequest) return;

  const enable = activeConfig.masterEnabled && activeConfig.network.enabled;
  chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enable ? ['default_performance_rules'] : [],
    disableRulesetIds: enable ? [] : ['default_performance_rules']
  }, () => {
    if (chrome.runtime.lastError) {
      console.warn('[UWPO Background] DNR update notice:', chrome.runtime.lastError.message);
    }
  });

  // Apply domain exemptions
  chrome.declarativeNetRequest.getDynamicRules((rules) => {
    const existingIds = (rules || []).filter(r => r.id >= 10000 && r.id < 20000).map(r => r.id);
    const newRules = (activeConfig.safety.allowlist || []).map((domain, index) => ({
      id: 10000 + index,
      priority: 100,
      action: { type: 'allow' },
      condition: {
        initiatorDomains: [domain.replace(/^https?:\/\//, '').split('/')[0]],
        resourceTypes: ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other']
      }
    }));

    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules: newRules
    });
  });
}

// Clear state when tab closes
if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.onRemoved) {
  chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabStates.has(tabId)) {
      tabStates.delete(tabId);
    }
  });
}

// Central Message Listener
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabId = sender.tab ? sender.tab.id : message.tabId;

    switch (message.action) {
      case 'GET_TAB_STATE': {
        const state = tabId ? tabStates.get(tabId) : null;
        sendResponse({ success: true, state, config: activeConfig });
        break;
      }

      case 'REPORT_PAGE_METRICS': {
        if (tabId && message.payload) {
          const current = tabStates.get(tabId) || { tabId };
          tabStates.set(tabId, { ...current, ...message.payload, lastUpdated: Date.now() });
          sendResponse({ success: true });
        }
        break;
      }

      case 'UPDATE_CONFIG': {
        if (message.payload) {
          activeConfig = message.payload;
          if (chrome.storage && chrome.storage.session) {
            chrome.storage.session.set({ uwpo_config_session: activeConfig });
          }
          syncDnrRules();

          // Forward update to active tab if provided
          if (message.tabId) {
            chrome.tabs.sendMessage(message.tabId, { action: 'UPDATE_CONFIG', payload: activeConfig }, () => {
              if (chrome.runtime.lastError) { /* ignore */ }
            });
          }
          sendResponse({ success: true, config: activeConfig });
        }
        break;
      }

      case 'EMERGENCY_RESET': {
        if (message.tabId) {
          chrome.tabs.sendMessage(message.tabId, { action: 'EMERGENCY_RESET' }, () => {
            if (chrome.runtime.lastError) { /* ignore */ }
          });
          sendResponse({ success: true });
        }
        break;
      }

      case 'CLEAR_SESSION_STATE': {
        tabStates.clear();
        if (chrome.storage && chrome.storage.session) {
          chrome.storage.session.clear();
        }
        activeConfig = { ...DEFAULT_CONFIG };
        syncDnrRules();
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ success: false, error: 'Unknown action' });
        break;
    }

    return true;
  });
}

